import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
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
import OperationalModeSelector from '../components/dashboard/OperationalModeSelector';
import { useStation } from '../context/StationContext';

export const CommandCenter = ({ stationId }: { stationId: number }) => {
  const { dashboard: ctxDashboard } = useStation();
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-reveal-card',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

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
    <div ref={containerRef} className="flex flex-col gap-5">
      {/* Interactive Command & Operational Mode selector */}
      <div className="gsap-reveal-card">
        <OperationalModeSelector />
      </div>

      {/* Environment — live telemetry cards */}
      <div className="gsap-reveal-card">
        <WeatherKpiRow dashboard={data} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: digital twin, energy predictions, equipment, logistics */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="gsap-reveal-card">
            <TwinOverviewCard dashboard={data} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="gsap-reveal-card">
              <EnergyOverviewCard energy={data.energy} />
            </div>
            <div className="gsap-reveal-card">
              <EnergyForecastCard forecast={energyForecast} />
            </div>
          </div>

          <div className="gsap-reveal-card">
            <EquipmentHealthCard equipment={data.equipment ?? []} />
          </div>
          <div className="gsap-reveal-card">
            <LogisticsCrewCard station={data.station} />
          </div>
        </div>

        {/* Right rail: alerts + copilot + automations */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="gsap-reveal-card">
            <ActiveAlertsPanel alerts={alerts} />
          </div>
          <div className="gsap-reveal-card">
            <CopilotInsightsCard dashboard={data} recommendations={recommendations} />
          </div>
          <div className="gsap-reveal-card">
            <RecentAutomationsCard stationId={stationId} />
          </div>
        </div>
      </div>

      {/* Simulation-driven predictive insights */}
      <div className="gsap-reveal-card">
        <PredictiveInsightsRow dashboard={data} fuelForecast={fuelForecast} energyForecast={energyForecast} />
      </div>

      {/* What-if simulation quick access */}
      <div className="gsap-reveal-card">
        <SimulationStrip stationId={stationId} />
      </div>

      <div className="gsap-reveal-card">
        <StatusFooter />
      </div>
    </div>
  );
};

export default CommandCenter;
