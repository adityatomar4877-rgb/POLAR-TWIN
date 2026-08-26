import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { getStations, getStationDashboard } from '../api/stations';
import type { Station, StationDashboardOut } from '../api/types';

export type CommandProcessingState =
  | 'IDLE'
  | 'PREVIEWING'
  | 'AWAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED';

export interface SubsystemFocus {
  equipmentId: number | null;
  label: string | null;
}

interface StationContextValue {
  /* station selection */
  stations: Station[];
  selectedStationId: number;
  setSelectedStationId: (id: number) => void;
  selectedStation: Station | null;
  dashboard: StationDashboardOut | undefined;
  isDashboardLoading: boolean;

  /* live link */
  wsConnected: boolean;
  lastSyncAt: Date | null;

  /* subsystem inspection */
  selectedSubsystem: SubsystemFocus;
  selectSubsystem: (focus: SubsystemFocus) => void;
  clearSubsystem: () => void;

  /* operational state */
  emergencyModeActive: boolean;
  setEmergencyModeActive: (active: boolean) => void;
  commandProcessingState: CommandProcessingState;
  setCommandProcessingState: (state: CommandProcessingState) => void;
}

const StationContext = createContext<StationContextValue | null>(null);

export function StationProvider({ children }: { children: ReactNode }) {
  const [selectedStationId, setSelectedStationId] = useState<number>(1);
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemFocus>({
    equipmentId: null,
    label: null,
  });
  const [emergencyModeActive, setEmergencyModeActive] = useState(false);
  const [commandProcessingState, setCommandProcessingState] =
    useState<CommandProcessingState>('IDLE');

  const { data: stations } = useQuery({
    queryKey: ['stations'],
    queryFn: getStations,
    staleTime: 5 * 60 * 1000,
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', selectedStationId],
    queryFn: () => getStationDashboard(selectedStationId),
    enabled: !!selectedStationId,
    refetchInterval: 15000,
  });

  const { isConnected, lastMessageTime } = useWebSocket(selectedStationId);

  const selectSubsystem = useCallback((focus: SubsystemFocus) => {
    setSelectedSubsystem(focus);
  }, []);

  const clearSubsystem = useCallback(() => {
    setSelectedSubsystem({ equipmentId: null, label: null });
  }, []);

  const value = useMemo<StationContextValue>(() => {
    return {
      stations: stations ?? [],
      selectedStationId,
      setSelectedStationId,
      selectedStation:
        stations?.find((s) => s.id === selectedStationId) ?? dashboard?.station ?? null,
      dashboard,
      isDashboardLoading: isLoading,

      wsConnected: isConnected,
      lastSyncAt: lastMessageTime,

      selectedSubsystem,
      selectSubsystem,
      clearSubsystem,

      emergencyModeActive,
      setEmergencyModeActive,
      commandProcessingState,
      setCommandProcessingState,
    };
  }, [
    stations,
    selectedStationId,
    dashboard,
    isLoading,
    isConnected,
    lastMessageTime,
    selectedSubsystem,
    selectSubsystem,
    clearSubsystem,
    emergencyModeActive,
    commandProcessingState,
  ]);

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export function useStation(): StationContextValue {
  const ctx = useContext(StationContext);
  if (!ctx) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return ctx;
}
