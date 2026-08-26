import { useQuery } from '@tanstack/react-query';
import { getStationDashboard, getStationRecommendations } from '../api/stations';
import { getEnergyPrediction, getFuelPrediction } from '../api/predictions';
import { Activity } from 'lucide-react';
import WeatherKpiRow from '../components/dashboard/WeatherKpiRow';
import TwinOverviewCard from '../components/dashboard/TwinOverviewCard';
import ActiveAlertsPanel from '../components/dashboard/ActiveAlertsPanel';
import EnergyOverviewCard from '../components/dashboard/EnergyOverviewCard';
import EnergyForecastCard from '../components/dashboard/EnergyForecastCard';
import CopilotInsightsCard from '../components/dashboard/CopilotInsightsCard';
import PredictiveInsightsRow from '../components/dashboard/PredictiveInsightsRow';
import EquipmentHealthCard from '../components/dashboard/EquipmentHealthCard';
import LogisticsCrewCard from '../components/dashboard/LogisticsCrewCard';
import SimulationStrip from '../components/dashboard/SimulationStrip';
import RecentAutomationsCard from '../components/dashboard/RecentAutomationsCard';
import StatusFooter from '../components/dashboard/StatusFooter';
import { Stagger, StaggerItem } from '../components/motion/primitives';
import { useStation } from '../context/StationContext';

export const CommandCenter = ({ stationId }: { stationId: number }) => {
  const { dashboard: ctxDashboard } = useStation();

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', stationId],
    queryFn: () => getStationDashboard(stationId),
    refetchInterval: 15000,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['recommendations', stationId],
    queryFn: () => getStationRecommendations(stationId),
    refetchInterval: 20000,
  });

  const { data: energyForecast } = useQuery({
    queryKey: ['energy-forecast', stationId],
    queryFn: () => getEnergyPrediction(stationId, 24),
    refetchInterval: 60000,
  });

  const { data: fuelForecast } = useQuery({
    queryKey: ['fuel-forecast', stationId],
    queryFn: () => getFuelPrediction(stationId),
    refetchInterval: 60000,
  });

  if ((isLoading && !ctxDashboard) || (!dashboard && !ctxDashboard)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-8 w-8 animate-spin text-blue-500" />
          <div className="animate-pulse text-sm font-medium tracking-wide text-slate-400">
            Initializing station overview...
          </div>
        </div>
      </div>
    );
  }

  const data = dashboard ?? ctxDashboard!;
  const alerts = dashboard?.alerts ?? ctxDashboard?.alerts ?? [];

  return (
    <Stagger className="flex flex-col gap-5">
      {/* Environment — live telemetry cards */}
      <StaggerItem>
        <WeatherKpiRow dashboard={data} />
      </StaggerItem>

      <StaggerItem>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left: digital twin, energy predictions, equipment, logistics */}
          <div className="flex min-w-0 flex-col gap-5">
            <TwinOverviewCard dashboard={data} />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <EnergyOverviewCard energy={data.energy} />
              <EnergyForecastCard forecast={energyForecast} />
            </div>

            <EquipmentHealthCard equipment={data.equipment ?? []} />
            <LogisticsCrewCard station={data.station} />
          </div>

          {/* Right rail: alerts + copilot + automations */}
          <div className="flex min-w-0 flex-col gap-5">
            <ActiveAlertsPanel alerts={alerts} />
            <CopilotInsightsCard dashboard={data} recommendations={recommendations} />
            <RecentAutomationsCard stationId={stationId} />
          </div>
        </div>
      </StaggerItem>

      {/* Simulation-driven predictive insights */}
      <StaggerItem>
        <PredictiveInsightsRow dashboard={data} fuelForecast={fuelForecast} energyForecast={energyForecast} />
      </StaggerItem>

      {/* What-if simulation quick access */}
      <StaggerItem>
        <SimulationStrip stationId={stationId} />
      </StaggerItem>

      <StaggerItem>
        <StatusFooter />
      </StaggerItem>
    </Stagger>
  );
};

export default CommandCenter;
