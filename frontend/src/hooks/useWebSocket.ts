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
  equipment_count?: number;
  new_alerts_triggered?: number;
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

    const handleMessage = (message: WsMessage) => {
      // Shape (a): raw telemetry tick carries numeric station_id directly
      if (typeof message.station_id === 'number' && message.station_id !== stationId) return;

      // Telemetry tick (no wrapper key): presence of energy/environment payload
      if (!message.event && (message.energy || message.environment)) {
        queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
        if ((message.new_alerts_triggered ?? 0) > 0) {
          queryClient.invalidateQueries({ queryKey: ['alerts', stationId] });
        }
        return;
      }

      // Shape (b): command event envelope { event, data }
      if (message.event === 'COMMAND_COMPLETED') {
        ['equipment', 'dashboard', 'alerts', 'operations-history', 'loads', 'recommendations'].forEach(
          (key) => queryClient.invalidateQueries({ queryKey: [key, stationId] })
        );
        return;
      }

      // Legacy typed envelope fallback
      if (message.type === 'TELEMETRY_UPDATE') {
        queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
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
        setLastMessageTime(new Date());
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
