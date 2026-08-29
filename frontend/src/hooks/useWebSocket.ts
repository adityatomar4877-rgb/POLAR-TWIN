import { useEffect, useState } from 'react';
import { WS_BASE_URL } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Backend broadcasts two message shapes over /ws/stations/{id}:
 *
 * 1) Telemetry tick (raw dict, no wrapper key):
 *    { station_id, station_code, timestamp, environment: {...}, energy: {...},
 *      equipment_count, new_alerts_triggered }
 *
 * 2) Command event envelope:
 *    { event: "COMMAND_COMPLETED", station_code, timestamp, data: {...} }
 */
export interface WsTelemetryTick {
  station_id?: number;
  station_code?: string;
  timestamp?: string;
  environment?: Record<string, unknown>;
  energy?: Record<string, unknown>;
  prediction?: Record<string, unknown>;
  fuel_forecast?: Record<string, unknown>;
  equipment_count?: number;
  new_alerts_triggered?: number;
  active_scenario?: string;
}

export interface WsCommandEvent {
  event?: string;
  station_code?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

export type WsMessage = WsTelemetryTick & WsCommandEvent & { type?: string };

export function useWebSocket(stationId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!stationId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // Perf: telemetry ticks can arrive every few seconds. Throttling context
    // updates and refetches to ~10s keeps the UI smooth while staying live.
    const TICK_THROTTLE_MS = 10000;
    let lastTickHandled = 0;
    let lastSyncPushed = 0;

    const handleTelemetryTick = () => {
      const now = Date.now();
      if (now - lastTickHandled < TICK_THROTTLE_MS) return;
      lastTickHandled = now;
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['predictions', stationId] });
      queryClient.invalidateQueries({ queryKey: ['simulation-status'] });
      // Equipment status is mutated by scenario ticks (e.g. GENERATOR_FAILURE →
      // OFFLINE) but is NOT carried in the WS payload — only equipment_count is.
      // Invalidate here so the 3D beacons/flows refresh from the latest state.
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
    };

    const handleMessage = (message: WsMessage) => {
      // Shape (a): raw telemetry tick carries numeric station_id directly
      if (typeof message.station_id === 'number' && message.station_id !== stationId) return;

      // Telemetry tick (no wrapper key): presence of energy/environment payload
      if (!message.event && (message.energy || message.environment)) {
        if ((message.new_alerts_triggered ?? 0) > 0) {
          queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
        }
        handleTelemetryTick();
        return;
      }

      // Shape (b): command event envelope { event, data } — always immediate
      if (message.event === 'COMMAND_COMPLETED') {
        ['equipment', 'dashboard', 'alerts', 'operations-history', 'loads', 'recommendations', 'predictions'].forEach(
          (key) => queryClient.invalidateQueries({ queryKey: [key, stationId] })
        );
        return;
      }

      // Legacy typed envelope fallback
      if (message.type === 'TELEMETRY_UPDATE') {
        handleTelemetryTick();
      }
      if (message.type === 'EQUIPMENT_UPDATE' || message.type === 'EQUIPMENT_STATE_CHANGED') {
        ['equipment', 'dashboard'].forEach((key) =>
          queryClient.invalidateQueries({ queryKey: [key, stationId] })
        );
      }
      if (message.type === 'ALERT_TRIGGERED') {
        queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
      }
    };

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(`${WS_BASE_URL}/stations/${stationId}`);

      ws.onopen = () => {
        if (disposed) return;
        setIsConnected(true);
        // Refresh initial state upon (re)connection
        queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
        queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
      };

      ws.onclose = () => {
        if (disposed) return;
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000); // auto-reconnect
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (event) => {
        const now = Date.now();
        // Push "last sync" timestamps at most every 5s to limit re-renders
        if (now - lastSyncPushed > 5000) {
          lastSyncPushed = now;
          setLastMessageTime(new Date());
        }
        try {
          const message: WsMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch {
          // Malformed frame; ignore.
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [stationId, queryClient]);

  return { isConnected, lastMessageTime };
}
