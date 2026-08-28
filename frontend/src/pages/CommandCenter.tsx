import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'framer-motion';
import { getStationDashboard, getStationRecommendations } from '../api/stations';
import { getEnergyPrediction, getFuelPrediction } from '../api/predictions';
import WeatherKpiRow from '../components/dashboard/WeatherKpiRow';
import TwinOverviewCard from '../components/dashboard/TwinOverviewCard';
import ActiveAlertsPanel from '../components/dashboard/ActiveAlertsPanel';
import EnergyOverviewCard from '../components/dashboard/EnergyOverviewCard';
import CopilotInsightsCard from '../components/dashboard/CopilotInsightsCard';
import PredictiveInsightsRow from '../components/dashboard/PredictiveInsightsRow';
import RecentAutomationsCard from '../components/dashboard/RecentAutomationsCard';
import StatusFooter from '../components/dashboard/StatusFooter';
import { ShimmerLoader } from '../components/motion/primitives';
import { useStation } from '../context/StationContext';

gsap.registerPlugin(ScrollTrigger);

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

  /* Enhanced cascading card reveal with parallax stagger and subtle scale */
  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      // Initial cascade entrance
      gsap.fromTo(
        '.gsap-reveal-card',
        { y: 28, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.55,
          stagger: 0.07,
          ease: 'power3.out',
          clearProps: 'scale',
        }
      );

      // Scroll-triggered reveals for below-fold cards
      const scrollCards = containerRef.current!.querySelectorAll('.gsap-scroll-reveal');
      scrollCards.forEach((card) => {
        gsap.fromTo(
          card,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 92%',
              toggleActions: 'play none none none',
            },
          }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, [stationId]);

  /* Shimmer skeleton loading state */
  if ((isLoading && !ctxDashboard) || (!dashboard && !ctxDashboard)) {
    return (
      <div className="flex flex-col gap-4 max-w-[1560px] mx-auto pb-6">
        {/* KPI row skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <ShimmerLoader key={i} height="96px" className="rounded-xl" />
          ))}
        </div>
        {/* Main grid skeleton */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_370px]">
          <ShimmerLoader height="380px" className="rounded-2xl" />
          <div className="flex flex-col gap-4">
            <ShimmerLoader height="180px" className="rounded-2xl" />
            <ShimmerLoader height="180px" className="rounded-2xl" />
          </div>
        </div>
        {/* Bottom row skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <ShimmerLoader key={i} height="200px" className="rounded-2xl" />
          ))}
        </div>

        {/* Centered loading indicator overlay */}
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-slate-400 animate-pulse">
              Initializing station overview…
            </p>
          </div>
        </motion.div>
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
        <div className="gsap-reveal-card gsap-scroll-reveal flex">
          <CopilotInsightsCard dashboard={data} recommendations={recommendations} />
        </div>
        <div className="gsap-reveal-card gsap-scroll-reveal flex">
          <PredictiveInsightsRow dashboard={data} fuelForecast={fuelForecast} energyForecast={energyForecast} />
        </div>
        <div className="gsap-reveal-card gsap-scroll-reveal flex">
          <RecentAutomationsCard stationId={stationId} />
        </div>
      </div>

      {/* 4. Bottom Mission Status & Telemetry Dock Footer with Polar Ship */}
      <div className="gsap-reveal-card gsap-scroll-reveal">
        <StatusFooter />
      </div>
    </div>
  );
};

export default CommandCenter;
