import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE_URL } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

export interface WsMessage {
  type: string;
  station_id: number;
  data?: any;
}

export function useWebSocket(stationId: number | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    if (!stationId) return;

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    const url = `${WS_BASE_URL}/stations/${stationId}`;
    console.log(`Connecting to WebSocket: ${url}`);
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      // Invalidate dashboard to get fresh initial state upon reconnection
      queryClient.invalidateQueries({ queryKey: ['dashboard', stationId] });
      queryClient.invalidateQueries({ queryKey: ['equipment', stationId] });
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.current?.close();
    };

    ws.current.onmessage = (event) => {
      setLastMessageTime(new Date());
      try {
        const message: WsMessage = JSON.parse(event.data);
        handleMessage(message, stationId, queryClient);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };
  }, [stationId, queryClient]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessageTime };
}

// Logic to handle different types of real-time events
function handleMessage(message: WsMessage, currentStationId: number, queryClient: any) {
  if (message.station_id !== currentStationId) return;

  // Real-time telemetry tick
  if (message.type === 'TELEMETRY_UPDATE') {
    // We could update a localized store here or update query cache directly
    // Instead of completely invalidating (which causes full HTTP fetch),
    // we can update the cache directly for high-frequency data if we want.
    // For now, let's trigger a soft invalidate or just rely on the WS for the UI.
    
    // Example of setting query data directly if needed:
    // queryClient.setQueryData(['dashboard', currentStationId], (oldData: any) => ({ ...oldData, ...message.data }));
    queryClient.invalidateQueries({ queryKey: ['dashboard', currentStationId] });
  }

  // Equipment state changed (e.g., STARTING -> RUNNING)
  if (message.type === 'EQUIPMENT_UPDATE' || message.type === 'EQUIPMENT_STATE_CHANGED') {
    queryClient.invalidateQueries({ queryKey: ['equipment', currentStationId] });
    queryClient.invalidateQueries({ queryKey: ['dashboard', currentStationId] });
  }

  // New alert triggered
  if (message.type === 'ALERT_TRIGGERED') {
    queryClient.invalidateQueries({ queryKey: ['alerts', currentStationId] });
  }
}
