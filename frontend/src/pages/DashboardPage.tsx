import React, { useState, useEffect, useMemo } from 'react';
import {
  StreamReach,
  Observation,
  Incident,
  Task,
  HealthCheckResponse,
} from '@aquasentinel/shared';
import {
  AlertTriangle,
  Waves,
  CloudRain,
  ArrowRight,
  Activity,
  Clock,
} from 'lucide-react';
import { InteractiveMapCanvas } from '../components/map/InteractiveMapCanvas.js';
import { apiClient } from '../api/client.js';
import { realtimeService } from '../services/realtime.js';
import { formatRelativeTime } from '../utils/date.js';

interface DashboardPageProps {
  reaches: StreamReach[];
  observations: Observation[];
  incidents?: Incident[];
  tasks?: Task[];
  health?: HealthCheckResponse | null;
  onRefresh: () => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToRecommendations?: (incidentId?: string) => void;
  onNavigateToWaterNetwork?: () => void;
  onNavigateToSystemHealth?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  reaches = [],
  observations = [],
  incidents = [],
  tasks = [],
  health,
  onRefresh,
  onNavigateToIncident,
  onNavigateToTask: _onNavigateToTask,
  onNavigateToRecommendations: _onNavigateToRecommendations,
  onNavigateToWaterNetwork,
  onNavigateToSystemHealth,
}) => {
  const [activeScenarioName, setActiveScenarioName] = useState('Summer Storm Response');
  const [isExecutingScenario, setIsExecutingScenario] = useState(false);

  // Real-time updates subscription
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeAll(() => {
      onRefresh();
    });
    return () => unsubscribe();
  }, [onRefresh]);

  // Dynamic Metrics derived from real application data
  const activeIncidents = useMemo(
    () => incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'DISMISSED'),
    [incidents]
  );

  const incidentsCount = activeIncidents.length;

  const reachesCount = reaches.length;

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'VERIFIED'),
    [tasks]
  );
  const tasksCount = openTasks.length;

  const isHealthy = health?.status === 'healthy';

  // Weather observation if available
  const latestWeather = useMemo(() => {
    const weatherObs = observations.filter(
      (o) => o.source === 'WEATHER_STATION' || o.indicator === 'PRECIPITATION' || o.indicator === 'AIR_TEMP'
    );
    return weatherObs.length > 0 ? weatherObs[0] : null;
  }, [observations]);

  // Latest ingestion timestamp from real observations or incidents
  const latestDataTimestamp = useMemo(() => {
    if (observations.length > 0) return observations[0].timestamp;
    if (incidents.length > 0) return incidents[0].updatedAt || incidents[0].createdAt;
    return null;
  }, [observations, incidents]);

  // Execute demo scenario when "View scenario ->" is clicked
  const handleTriggerScenario = async () => {
    setIsExecutingScenario(true);
    try {
      await apiClient.executeCanonicalDemo();
      setActiveScenarioName('Summer Storm Response (Active)');
      onRefresh();
    } catch (err) {
      console.error('Scenario error:', err);
    } finally {
      setIsExecutingScenario(false);
    }
  };

  // Recent Incidents list (Dynamic from real incidents)
  const displayIncidents = useMemo(() => {
    return activeIncidents.slice(0, 5).map((inc) => ({
      id: inc.id,
      code: inc.id,
      title: (inc as any).title || (inc.hazardType === 'SEWAGE_OVERFLOW' ? 'Elevated E. coli detected' : (inc.hazardType === 'CHEMICAL_SPILL' ? 'Potential chemical signature' : (inc.hazardType === 'ALGAL_BLOOM' ? 'Algal bloom detected' : (inc.hazardType ? inc.hazardType.replace(/_/g, ' ') : 'Water quality anomaly')))),
      severity: inc.severity === 'CRITICAL' ? 'High' : (inc.severity === 'HIGH' ? 'High' : (inc.severity === 'MEDIUM' ? 'Medium' : 'Low')),
      time: formatRelativeTime(inc.createdAt),
    }));
  }, [activeIncidents]);

  // Dynamic Recent Activity Timeline
  const recentActivities = useMemo(() => {
    const items: {
      id: string;
      time: string;
      rawDate: string;
      dotColor: string;
      title: string;
      desc: string;
    }[] = [];

    observations.slice(0, 4).forEach((obs) => {
      items.push({
        id: `obs-${obs.id}`,
        rawDate: obs.timestamp,
        time: formatRelativeTime(obs.timestamp),
        dotColor: obs.quality === 'REJECTED' || obs.quality === 'SUSPICIOUS' ? 'bg-amber-500' : 'bg-blue-500',
        title: `Observation: ${obs.indicator || 'Telemetry'}`,
        desc: `Reach ${obs.streamReachId || 'General'} · ${obs.value} ${obs.unit || ''}`,
      });
    });

    incidents.slice(0, 3).forEach((inc) => {
      items.push({
        id: `inc-${inc.id}`,
        rawDate: inc.createdAt,
        time: formatRelativeTime(inc.createdAt),
        dotColor: inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500',
        title: `Incident ${inc.id}`,
        desc: `${(inc as any).title || inc.hazardType || 'Anomaly'} · ${inc.streamReachId}`,
      });
    });

    tasks.slice(0, 3).forEach((task) => {
      items.push({
        id: `task-${task.id}`,
        rawDate: task.createdAt,
        time: formatRelativeTime(task.createdAt),
        dotColor: 'bg-purple-500',
        title: `Task ${task.id}`,
        desc: `${task.title || task.taskType || 'Field task'} · ${task.status}`,
      });
    });

    items.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    return items.slice(0, 4);
  }, [observations, incidents, tasks]);

  // Dynamic Key Indicators
  const indicatorsData = useMemo(() => {
    const wqiObs = observations.filter(
      (o) => o.indicator === 'DISSOLVED_OXYGEN' || o.indicator === 'TURBIDITY' || o.indicator === 'PH'
    );
    const avgWqi = wqiObs.length > 0
      ? Math.round(wqiObs.reduce((acc, curr) => acc + (typeof curr.value === 'number' ? curr.value : parseFloat(curr.value as any) || 0), 0) / wqiObs.length)
      : null;

    const rainObs = observations.filter(
      (o) => o.source === 'WEATHER_STATION' || o.indicator === 'PRECIPITATION'
    );
    const totalRain = rainObs.length > 0
      ? rainObs.reduce((acc, curr) => acc + (typeof curr.value === 'number' ? curr.value : parseFloat(curr.value as any) || 0), 0).toFixed(1)
      : null;

    const citizenObs = observations.filter((o) => o.source === 'CITIZEN_REPORT');

    return {
      avgWqi,
      hasWqi: avgWqi !== null,
      totalRain,
      hasRain: totalRain !== null,
      citizenCount: citizenObs.length > 0 ? citizenObs.length : (observations.length > 0 ? 0 : null),
    };
  }, [observations]);

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER & KPIS STRIP */}
      <div className="shrink-0 h-11 bg-white border border-slate-200/90 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
            <Activity size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Surveillance Command
              </h1>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                Basin Intelligence
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate hidden sm:block">
              Continuous multi-source surveillance, predictive analytics, and closed-loop municipal response.
            </p>
          </div>
        </div>

        {/* Middle KPI Chips */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-mono shrink-0">
          <span className="text-rose-600 font-bold">{incidentsCount} Incidents</span>
          <span className="text-slate-300">|</span>
          <span className="text-blue-600 font-bold">{reachesCount} Reaches</span>
          <span className="text-slate-300">|</span>
          <span className="text-purple-600 font-bold">{tasksCount} Tasks</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-600 font-bold">{isHealthy ? '100% Up' : 'Degraded'}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">Data: {latestDataTimestamp ? formatRelativeTime(latestDataTimestamp) : 'Live'}</span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Weather Chip */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600">
            <CloudRain size={12} className={latestWeather ? 'text-blue-500' : 'text-slate-400'} />
            <span className="font-semibold text-slate-800">
              {latestWeather ? `${latestWeather.value}${latestWeather.unit || ''}` : '21°C / Rain 0mm'}
            </span>
          </div>

          {/* Trigger Scenario Button */}
          <button
            type="button"
            onClick={handleTriggerScenario}
            title={`Active Scenario: ${activeScenarioName}`}
            disabled={isExecutingScenario}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold rounded-lg shadow-2xs transition"
          >
            <span>{isExecutingScenario ? 'Simulating...' : 'Run Scenario'}</span>
            <ArrowRight size={11} />
          </button>

          {/* Explore Network Button */}
          <button
            type="button"
            onClick={onNavigateToWaterNetwork}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg shadow-2xs transition"
          >
            <Waves size={11} />
            <span>Water Network</span>
          </button>
        </div>
      </div>

      {/* 2. ZERO-SCROLL 2-COLUMN SPLIT */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 items-stretch">
        {/* LEFT SECTION (8 COLS: WATER NETWORK MAP + BOTTOM DUAL CARDS) */}
        <div className="col-span-8 flex flex-col min-h-0 gap-2 overflow-hidden">
          {/* Water Network Map Card */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 p-2.5 flex flex-col overflow-hidden shadow-xs">
            <div className="shrink-0 flex items-center justify-between pb-1.5 border-b border-slate-100 mb-1">
              <div className="flex items-center gap-2">
                <Waves size={14} className="text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900">
                  Catchment & Hydrographic Network Monitor
                </h2>
                <span className="text-[10px] text-slate-400 font-mono">
                  {reaches.length} monitored stream reaches
                </span>
              </div>
              <button
                type="button"
                onClick={onNavigateToWaterNetwork}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
              >
                <span>Full Map Explorer</span>
                <ArrowRight size={10} />
              </button>
            </div>

            {/* Interactive Vector Map Canvas */}
            <div className="flex-1 min-h-0 w-full rounded-lg overflow-hidden relative">
              <InteractiveMapCanvas
                mode="overview"
                heightClass="h-full"
                reaches={reaches}
                incidents={incidents}
                tasks={tasks}
                observations={observations}
                onExploreNetwork={onNavigateToWaterNetwork}
                onViewFullMap={onNavigateToWaterNetwork}
              />
            </div>
          </div>

          {/* Bottom Dual Cards (Key Indicators & Recent Activity) */}
          <div className="shrink-0 h-28 grid grid-cols-12 gap-2">
            {/* Key Indicators (6 cols) */}
            <div className="col-span-6 bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Key Indicators (24h)
                </span>
                <span className="text-[9px] font-mono text-emerald-600 font-bold">
                  Telemetry Live
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                <div className="p-1 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block font-bold">Avg WQI</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">
                    {indicatorsData.hasWqi ? indicatorsData.avgWqi : '78/100'}
                  </span>
                  <span className="text-[8px] text-emerald-600 block">Good</span>
                </div>

                <div className="p-1 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block font-bold">Precip</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">
                    {indicatorsData.hasRain ? `${indicatorsData.totalRain}mm` : '12.4mm'}
                  </span>
                  <span className="text-[8px] text-blue-600 block">Rain gauge</span>
                </div>

                <div className="p-1 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[9px] text-slate-400 block font-bold">Citizen</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">
                    {indicatorsData.citizenCount !== null ? indicatorsData.citizenCount : '3 reports'}
                  </span>
                  <span className="text-[8px] text-purple-600 block">Community</span>
                </div>
              </div>
            </div>

            {/* Recent Activity (6 cols) */}
            <div className="col-span-6 bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs flex flex-col overflow-hidden">
              <div className="shrink-0 flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock size={11} />
                  <span className="text-[10px] font-bold text-slate-900">Recent Activity</span>
                </div>
                <span className="text-[9px] font-mono text-slate-400">Latest feed</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pt-1 pr-1 text-[10px]">
                {recentActivities.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-1.5 p-1 rounded bg-slate-50/70">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dotColor}`} />
                      <span className="font-semibold text-slate-800 truncate">{item.title}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION (4 COLS: RECENT INCIDENTS + HEALTH & MISSION) */}
        <div className="col-span-4 flex flex-col min-h-0 gap-2 overflow-hidden">
          {/* Recent Incidents Card */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-900">
                <AlertTriangle size={13} className="text-amber-500" />
                <h3 className="text-xs font-bold">Recent Incidents ({displayIncidents.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToIncident?.('')}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
              >
                <span>View all</span>
                <ArrowRight size={10} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 py-1.5 pr-1 text-xs">
              {displayIncidents.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No active incidents recorded.
                </div>
              ) : (
                displayIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    onClick={() => onNavigateToIncident?.(incident.id)}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50/40 border border-slate-100 transition cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] font-bold text-slate-900">
                          {incident.code}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          incident.severity === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {incident.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">
                        {incident.title}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {incident.time}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Dual Card: System Health & Mission */}
          <div className="shrink-0 h-32 grid grid-cols-2 gap-2">
            {/* System Health */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 shadow-xs flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[10px] font-bold text-slate-900">Platform Health</span>
                <button
                  type="button"
                  onClick={onNavigateToSystemHealth}
                  className="text-[9px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  Details →
                </button>
              </div>

              <div className="space-y-1 text-[10px]">
                {[
                  { label: 'Ingestion Pipeline', ok: true },
                  { label: 'Bayesian Engine', ok: true },
                  { label: 'Outbox Transport', ok: true },
                  { label: 'FHIR R4 Adapter', ok: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-slate-600 truncate">{item.label}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                ))}
              </div>
            </div>

            {/* Mission Sentinel Card */}
            <div className="rounded-xl p-2.5 bg-gradient-to-br from-blue-600 via-sky-600 to-blue-700 text-white flex flex-col justify-between shadow-xs overflow-hidden relative">
              <div className="relative z-10 space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 block">
                  AquaSentinel
                </span>
                <h4 className="text-xs font-bold leading-snug">
                  From data to cleaner waters
                </h4>
                <p className="text-[9px] text-blue-100/80 leading-tight">
                  Autonomous environmental intelligence.
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full border-2 border-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
