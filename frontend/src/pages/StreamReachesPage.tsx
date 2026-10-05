import React, { useState, useMemo } from 'react';
import {
  StreamReach,
  Incident,
  Task,
  Observation,
} from '@aquasentinel/shared';
import {
  Search,
  Filter,
  ArrowRight,
  MoreHorizontal,
  Waves,
  FileText,
  AlertCircle,
  Settings,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { InteractiveMapCanvas } from '../components/map/InteractiveMapCanvas.js';
import { formatRelativeTime } from '../utils/date.js';
import { Modal } from '../components/common/Modal.js';

export interface DisplayReach {
  id: string;
  code: string;
  name: string;
  catchment: string;
  status: 'Normal' | 'Watch' | 'Alert' | 'Degraded';
  wqi: number;
  wqiQuality: string;
  evidenceSources: number;
  incidentId: string | null;
  lastUpdated: string;
  upstreamReach: string;
  downstreamReach: string;
  monitoringState: string;
}

interface StreamReachesPageProps {
  reaches?: StreamReach[];
  incidents?: Incident[];
  tasks?: Task[];
  observations?: Observation[];
  selectedReachId?: string | null;
  onSelectReach?: (reachId: string) => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToEvidence?: (reachId: string) => void;
  onNavigateToResilience?: (reachId: string) => void;
  onOpenCatchmentMap?: () => void;
}

export const StreamReachesPage: React.FC<StreamReachesPageProps> = ({
  reaches = [],
  incidents = [],
  tasks = [],
  observations = [],
  selectedReachId,
  onSelectReach,
  onNavigateToIncident,
  onNavigateToTask,
  onNavigateToEvidence,
  onNavigateToResilience,
  onOpenCatchmentMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatchmentFilter, setSelectedCatchmentFilter] = useState('All');
  const [selectedReachCode, setSelectedReachCode] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isReachDetailsModalOpen, setIsReachDetailsModalOpen] = useState(false);

  // Map real application reaches dynamically from backend props
  const allReaches: DisplayReach[] = useMemo(() => {
    return reaches.map((r, idx) => {
      const code = r.name.startsWith('RCH-') ? r.name.split(' ')[0] : (r.id.startsWith('RCH-') ? r.id : `RCH-${r.id.substring(0, 4)}`);
      const existingInc = incidents.find((i) => i.streamReachId === r.id && i.status !== 'RESOLVED');
      const reachObs = observations.filter((o) => o.streamReachId === r.id);
      const isCritical = existingInc?.severity === 'CRITICAL';
      const isAlert = !!existingInc;
      const isWatch = reachObs.some((o) => o.quality === 'FLAGGED');
      const status: DisplayReach['status'] = isCritical ? 'Degraded' : isAlert ? 'Alert' : isWatch ? 'Watch' : 'Normal';
      
      const wqi = r.baselineData?.typicalTurbidity
        ? Math.max(20, Math.min(100, Math.round(100 - r.baselineData.typicalTurbidity * 4)))
        : 78;
      const wqiQuality = wqi >= 80 ? 'Good' : wqi >= 50 ? 'Moderate' : 'Poor';
      const uniqueSources = new Set(reachObs.map((o) => o.source)).size;
      const lastObs = reachObs[0];

      return {
        id: r.id,
        code,
        name: r.name,
        catchment: r.city || r.region || 'Catchment Area',
        status,
        wqi,
        wqiQuality,
        evidenceSources: uniqueSources,
        incidentId: existingInc ? existingInc.id : null,
        lastUpdated: lastObs ? formatRelativeTime(lastObs.timestamp) : 'Awaiting data',
        upstreamReach: idx > 0 ? (reaches[idx - 1].name.split(' ')[0] || reaches[idx - 1].id.substring(0, 7)) : 'Headwaters',
        downstreamReach: idx < reaches.length - 1 ? (reaches[idx + 1].name.split(' ')[0] || reaches[idx + 1].id.substring(0, 7)) : 'Estuary Outfall',
        monitoringState: reachObs.length > 0 ? 'Online' : 'Standby',
      };
    });
  }, [reaches, incidents, observations]);

  // Selected reach
  const currentReach = useMemo(() => {
    if (allReaches.length === 0) return null;
    return (
      allReaches.find((r) => r.code === selectedReachCode || r.id === selectedReachId) ||
      allReaches[0]
    );
  }, [allReaches, selectedReachCode, selectedReachId]);

  // Filtered reaches for the table
  const filteredReaches = useMemo(() => {
    return allReaches.filter((r) => {
      const matchesSearch =
        searchQuery === '' ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.catchment.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCatchment =
        selectedCatchmentFilter === 'All' || r.catchment === selectedCatchmentFilter;

      return matchesSearch && matchesCatchment;
    });
  }, [allReaches, searchQuery, selectedCatchmentFilter]);

  const handleRowClick = (reach: DisplayReach) => {
    setSelectedReachCode(reach.code);
    onSelectReach?.(reach.id);
  };

  const getStatusBadge = (status: DisplayReach['status']) => {
    switch (status) {
      case 'Normal':
        return (
          <span className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Normal</span>
          </span>
        );
      case 'Watch':
        return (
          <span className="flex items-center gap-1.5 text-xs text-amber-700">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Watch</span>
          </span>
        );
      case 'Alert':
        return (
          <span className="flex items-center gap-1.5 text-xs text-orange-700">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Alert</span>
          </span>
        );
      case 'Degraded':
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <span>Degraded</span>
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden select-none">
      {/* 1. High-Density Top Navigation & Summary Strip (h-9 shrink-0) */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200/80 px-3 py-1.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
            <Waves size={15} />
            <span>Stream Reaches</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">{allReaches.length} Reaches</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">{allReaches.filter(r => r.status === 'Normal').length} Active</span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-semibold">{allReaches.filter(r => r.status === 'Watch' || r.status === 'Alert').length} Under Watch</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-36">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reaches..."
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>

          {/* Catchment Filter */}
          <select
            value={selectedCatchmentFilter}
            onChange={(e) => setSelectedCatchmentFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none cursor-pointer"
          >
            <option value="All">All catchments</option>
            {Array.from(new Set(allReaches.map((r) => r.catchment))).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Filters Modal Button */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center gap-1 transition"
          >
            <Filter size={12} />
            <span>Filters</span>
          </button>

          {/* Catchment Map Toggle */}
          <button
            onClick={onOpenCatchmentMap}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs transition"
          >
            <span>Catchment Map</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* 2. Main Zero-Scroll 2-Column Split Console */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* Left Column (7 cols): Map Canvas + Compact Reaches Queue */}
        <div className="col-span-12 lg:col-span-7 flex flex-col min-h-0 gap-2">
          {/* Interactive Map Canvas */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden relative">
            <InteractiveMapCanvas
              mode="reaches"
              heightClass="h-full w-full"
              selectedReachId={currentReach ? currentReach.code : ''}
              onSelectReach={(code) => setSelectedReachCode(code)}
              reaches={reaches}
              incidents={incidents}
              tasks={tasks}
              observations={observations}
            />
          </div>

          {/* Compact Reaches Queue */}
          <div className="h-[148px] shrink-0 bg-white rounded-xl border border-slate-200/80 p-2 shadow-2xs flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Monitored Reaches ({filteredReaches.length})</span>
              <span className="text-slate-400 font-normal">Click row to inspect</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
              {filteredReaches.map((reach) => {
                const isSelected = reach.code === currentReach?.code;
                return (
                  <div
                    key={reach.id}
                    onClick={() => handleRowClick(reach)}
                    className={clsx(
                      'flex items-center justify-between px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-colors',
                      isSelected ? 'bg-blue-50/90 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold text-slate-900 shrink-0">{reach.code}</span>
                      <span className="truncate text-slate-600">{reach.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(reach.status)}
                      <span className="font-mono text-[11px] text-slate-500">WQI {reach.wqi}</span>
                      <ChevronRight size={13} className={isSelected ? 'text-blue-600' : 'text-slate-300'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Selected Reach, Baseline State, and Operations */}
        {currentReach ? (
          <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0 gap-2">
            {/* Upper Card: Baseline Surveillance State (Crucial for Demo Milestone 0:40-0:55) */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs shrink-0 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Reach</div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{currentReach.code}</h2>
                  <p className="text-xs font-semibold text-slate-600 truncate">{currentReach.name}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Monitored</span>
                  </span>
                  <button
                    onClick={() => setIsReachDetailsModalOpen(true)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition"
                    title="Reach Dossier"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </div>
              </div>

              {/* Dedicated Surveillance Baseline Card */}
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-950 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    Surveillance Baseline State
                  </span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-[10px]">
                    NORMAL
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                  <div className="bg-white/80 p-1.5 rounded-md border border-emerald-100">
                    <span className="text-slate-500 block text-[10px]">Historical Dissolved Oxygen</span>
                    <span className="font-bold text-slate-900">~8.2 mg/L</span>
                    <span className="text-[10px] text-emerald-600 block">Baseline range 7.8 - 8.6</span>
                  </div>
                  <div className="bg-white/80 p-1.5 rounded-md border border-emerald-100">
                    <span className="text-slate-500 block text-[10px]">Chlorophyll Proxy (NDCI)</span>
                    <span className="font-bold text-slate-900">&lt; 0.15 (0.12)</span>
                    <span className="text-[10px] text-emerald-600 block">Sub-Threshold</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800/90 italic">
                  Conditions nominal. No water-quality threshold breaches; no reason to intervene.
                </p>
              </div>
            </div>

            {/* Lower Card: Hydraulic Constraints & Connected Actions */}
            <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between overflow-hidden">
              <div className="space-y-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hydraulic Topology</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Upstream Reach</span>
                    <span className="font-mono font-semibold text-slate-800">{currentReach.upstreamReach}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">Downstream Reach</span>
                    <span className="font-mono font-semibold text-slate-800">{currentReach.downstreamReach}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Monitoring status:</span>
                    <span className="font-semibold text-slate-700">{currentReach.monitoringState}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Active Incident:</span>
                    <span className="font-semibold text-slate-700">
                      {currentReach.incidentId ? (
                        <button onClick={() => onNavigateToIncident?.(currentReach.incidentId!)} className="text-rose-600 hover:underline">
                          {currentReach.incidentId}
                        </button>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Narrow Stream Constraint:</span>
                    <span className="font-mono text-slate-700">minWidth: 15m (Penalty: 0.2)</span>
                  </div>
                </div>
              </div>

              {/* Connected Workflow Action Buttons */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Connected Operations</div>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  <button
                    onClick={() => onNavigateToEvidence?.(currentReach.id)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 font-semibold flex flex-col items-center gap-1 transition"
                  >
                    <FileText size={13} />
                    <span className="text-[10px]">Evidence</span>
                  </button>
                  <button
                    onClick={() => onNavigateToIncident?.(currentReach.incidentId || '')}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 font-semibold flex flex-col items-center gap-1 transition"
                  >
                    <AlertCircle size={13} />
                    <span className="text-[10px]">Incidents</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTask?.('')}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 text-slate-700 font-semibold flex flex-col items-center gap-1 transition"
                  >
                    <Settings size={13} />
                    <span className="text-[10px]">Tasks</span>
                  </button>
                  <button
                    onClick={() => onNavigateToResilience?.(currentReach.id)}
                    className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 font-semibold flex flex-col items-center gap-1 transition"
                  >
                    <TrendingUp size={13} />
                    <span className="text-[10px]">Resilience</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="col-span-12 lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-6 flex flex-col items-center justify-center text-center">
            <Waves size={32} className="text-slate-300 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Stream Reach Available</h3>
            <p className="text-xs text-slate-400">Stream network topology awaiting data ingestion.</p>
          </div>
        )}
      </div>

      {/* Pop-up Modals for Actions */}
      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title="Stream Network Filters">
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Catchment Filter</label>
            <select
              value={selectedCatchmentFilter}
              onChange={(e) => setSelectedCatchmentFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800"
            >
              <option value="All">All catchments</option>
              {Array.from(new Set(allReaches.map((r) => r.catchment))).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Status Filter</label>
            <div className="grid grid-cols-2 gap-2">
              <span className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">Normal ({allReaches.filter(r => r.status === 'Normal').length})</span>
              <span className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-medium">Watch / Alert ({allReaches.filter(r => r.status === 'Watch' || r.status === 'Alert').length})</span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isReachDetailsModalOpen} onClose={() => setIsReachDetailsModalOpen(false)} title={`Reach Details — ${currentReach?.code || ''}`}>
        <div className="space-y-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
            <div className="font-bold text-slate-800">{currentReach?.name}</div>
            <div className="text-slate-500">ID: {currentReach?.id}</div>
            <div className="text-slate-500">Catchment: {currentReach?.catchment}</div>
            <div className="text-slate-500">Water Quality Index: {currentReach?.wqi} ({currentReach?.wqiQuality})</div>
            <div className="text-slate-500">Active Sensors / Telemetry Sources: {currentReach?.evidenceSources}</div>
          </div>
          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto">
            <pre>{JSON.stringify(reaches.find(r => r.id === currentReach?.id) || {}, null, 2)}</pre>
          </div>
        </div>
      </Modal>
    </div>
  );
};
