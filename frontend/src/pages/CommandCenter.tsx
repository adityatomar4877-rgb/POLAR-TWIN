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
import CopilotInsightsCard from '../components/dashboard/CopilotInsightsCard';
import PredictiveInsightsRow from '../components/dashboard/PredictiveInsightsRow';
import RecentAutomationsCard from '../components/dashboard/RecentAutomationsCard';
import StatusFooter from '../components/dashboard/StatusFooter';
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
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.04, ease: 'power2.out' }
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
    <div ref={containerRef} className="flex flex-col gap-4 max-w-[1560px] mx-auto pb-6">
      {/* 1. Top KPI Row (5 Weather & Station Status Cards) */}
      <div className="gsap-reveal-card">
        <WeatherKpiRow dashboard={data} />
      </div>

      {/* 2. Middle Main Grid: Digital Twin Overview (Left) + Active Alerts & Energy Overview (Right) */}
      <div className="grid grid-cols-1 gap-4 items-start lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        {/* Left: Digital Twin Overview 3D Viewport */}
        <div className="gsap-reveal-card flex flex-col">
          <TwinOverviewCard dashboard={data} />
        </div>

        {/* Right: Active Alerts & Energy Overview */}
        <div className="flex flex-col gap-4">
          <div className="gsap-reveal-card">
            <ActiveAlertsPanel alerts={alerts} />
          </div>
          <div className="gsap-reveal-card">
            <EnergyOverviewCard energy={data.energy} />
          </div>
        </div>
      </div>

      {/* 3. Bottom Row: 3 Insight Cards (AI Copilot + Predictive Insights + Recent Automations) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="gsap-reveal-card flex">
          <CopilotInsightsCard dashboard={data} recommendations={recommendations} />
        </div>
        <div className="gsap-reveal-card flex">
          <PredictiveInsightsRow dashboard={data} fuelForecast={fuelForecast} energyForecast={energyForecast} />
        </div>
        <div className="gsap-reveal-card flex">
          <RecentAutomationsCard stationId={stationId} />
        </div>
      </div>

      {/* 4. Bottom Mission Status & Telemetry Dock Footer with Polar Ship */}
      <div className="gsap-reveal-card">
        <StatusFooter />
      </div>
    </div>
  );
};

export default CommandCenter;
