import React, { useState, useMemo } from 'react';
import {
  StreamReach,
  Incident,
  Task,
  Observation,
} from '@aquasentinel/shared';
import {
  Search,
  Layers,
  RotateCcw,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../components/common/Modal.js';
import {
  InteractiveMapCanvas,
  buildDynamicCatchments,
  CatchmentData,
} from '../components/map/InteractiveMapCanvas.js';

interface MapPageProps {
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
  onNavigateToStreamReaches?: (reachId?: string) => void;
}

export const MapPage: React.FC<MapPageProps> = ({
  reaches = [],
  incidents = [],
  tasks = [],
  observations = [],
  selectedReachId = null,
  onSelectReach,
  onNavigateToIncident,
  onNavigateToTask: _onNavigateToTask,
  onNavigateToEvidence,
  onNavigateToResilience,
  onNavigateToStreamReaches,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatchmentId, setSelectedCatchmentId] = useState<string | null>(null);
  const [activeReachCode, setActiveReachCode] = useState(selectedReachId || reaches[0]?.id || '');
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);

  const dynamicCatchments = useMemo(() => {
    return buildDynamicCatchments(reaches, incidents, observations);
  }, [reaches, incidents, observations]);

  // Currently selected catchment
  const currentCatchment: CatchmentData = useMemo(() => {
    return (
      dynamicCatchments.find((c) => c.id === selectedCatchmentId) ||
      dynamicCatchments[0]
    );
  }, [dynamicCatchments, selectedCatchmentId]);

  // Reaches belonging to selected catchment
  const catchmentReaches = useMemo(() => {
    if (!currentCatchment) return [];
    return currentCatchment.reachIds.map((code) => {
      const match = reaches.find((r) => r.id === code);
      const reachIncidents = incidents.filter(
        (i) => i.streamReachId === code && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
      );
      const status = reachIncidents.length > 0 ? (reachIncidents[0].severity === 'CRITICAL' ? 'Degraded' : 'Watch') : 'Normal';
      return {
        code,
        name: match ? match.name : `Reach ${code}`,
        status,
      };
    });
  }, [currentCatchment, reaches, incidents]);

  const handleSelectReachInCatchment = (code: string) => {
    setActiveReachCode(code);
    onSelectReach?.(code);
  };

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden select-none">
      {/* 1. Header Strip (h-9 shrink-0) */}
      <div className="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200/80 px-3 py-1.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-blue-700 font-bold text-xs">
            <MapPin size={15} />
            <span>Catchment Spatial Context</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">{dynamicCatchments.length} Catchments</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold">{reaches.length} Monitored Reaches</span>
            {currentCatchment && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">Current: {currentCatchment.name}</span>
            )}
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catchment..."
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>

          <button
            onClick={() => setIsLayersModalOpen(true)}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center gap-1 transition"
          >
            <Layers size={12} />
            <span>Map Layers</span>
          </button>

          <button
            onClick={() => {
              setSelectedCatchmentId(dynamicCatchments[0]?.id || null);
              setActiveReachCode(reaches[0]?.id || '');
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center gap-1 transition"
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>

          {onNavigateToStreamReaches && (
            <button
              onClick={() => onNavigateToStreamReaches(activeReachCode)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs transition"
            >
              <span>Stream Reaches</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Zero-Scroll 2-Column Split Console */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* Left Column (8 cols): Map Canvas + Catchment Switcher Strip */}
        <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 gap-2">
          {/* Map Canvas */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden relative">
            <InteractiveMapCanvas
              mode="catchments"
              heightClass="h-full w-full"
              selectedCatchmentId={selectedCatchmentId}
              selectedReachId={activeReachCode}
              onSelectCatchment={(id) => setSelectedCatchmentId(id)}
              onSelectReach={(code) => setActiveReachCode(code)}
              reaches={reaches}
              incidents={incidents}
              tasks={tasks}
              observations={observations}
            />
          </div>

          {/* Catchment Switcher Strip */}
          <div className="h-[95px] shrink-0 bg-white rounded-xl border border-slate-200/80 p-2 shadow-2xs flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Catchment Network Overview</span>
              <span className="text-slate-400 font-normal">Click to focus catchment</span>
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
              {dynamicCatchments.map((catchment) => {
                const isSelected = catchment.id === currentCatchment?.id;
                return (
                  <div
                    key={catchment.id}
                    onClick={() => {
                      setSelectedCatchmentId(catchment.id);
                      if (catchment.reachIds[0]) setActiveReachCode(catchment.reachIds[0]);
                    }}
                    className={clsx(
                      'p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col justify-between',
                      isSelected
                        ? 'bg-blue-50/90 border-blue-300 text-blue-900 shadow-2xs'
                        : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200/70 text-slate-700'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] truncate">{catchment.name}</span>
                      <span className="text-[10px] px-1 rounded bg-emerald-100 text-emerald-800 font-medium">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>{catchment.reachesCount} reaches</span>
                      <span>{catchment.stationsCount} stations</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Selected Catchment & Connected Reaches */}
        {currentCatchment && (
          <div className="col-span-12 lg:col-span-4 bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-col justify-between min-h-0 overflow-hidden">
            <div className="space-y-2 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Catchment</div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">{currentCatchment.name}</h2>
                  <p className="font-mono text-[11px] font-semibold text-slate-500">{currentCatchment.code}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Active Basin
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Monitored Reaches</span>
                  <span className="text-base font-bold text-slate-900">{currentCatchment.reachesCount}</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Monitoring Points</span>
                  <span className="text-base font-bold text-slate-900">{currentCatchment.stationsCount}</span>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="space-y-1 pt-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Primary Land Use:</span>
                  <span className="font-semibold text-slate-700">{currentCatchment.landUse}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Catchment Area:</span>
                  <span className="font-mono text-slate-700">{currentCatchment.area}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Downstream Outfall:</span>
                  <span className="font-semibold text-blue-700">{currentCatchment.downstream}</span>
                </div>
              </div>

              {/* Reaches in this Catchment */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  <span>Reaches in this Basin</span>
                  {onNavigateToStreamReaches && (
                    <button
                      onClick={() => onNavigateToStreamReaches(activeReachCode)}
                      className="text-blue-600 hover:underline capitalize font-semibold"
                    >
                      View all →
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {catchmentReaches.map((reach) => {
                    const isSelected = reach.code === activeReachCode;
                    return (
                      <div
                        key={reach.code}
                        onClick={() => handleSelectReachInCatchment(reach.code)}
                        className={clsx(
                          'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors',
                          isSelected
                            ? 'bg-blue-50/90 border-blue-300 font-semibold text-blue-900'
                            : 'hover:bg-slate-50 border-slate-100 text-slate-700'
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[10px] font-bold">{reach.code}</span>
                          <span className="truncate">{reach.name}</span>
                        </div>
                        <span className={clsx(
                          'w-2 h-2 rounded-full shrink-0',
                          reach.status === 'Normal' ? 'bg-emerald-500' : 'bg-amber-500'
                        )} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Connected Navigation */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-center text-xs">
              <button
                onClick={() => onNavigateToEvidence?.(activeReachCode)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition text-[11px] font-medium"
              >
                Evidence
              </button>
              <button
                onClick={() => onNavigateToIncident?.('')}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 transition text-[11px] font-medium"
              >
                Incidents
              </button>
              <button
                onClick={() => onNavigateToResilience?.(activeReachCode)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition text-[11px] font-medium"
              >
                Resilience
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Layers Modal */}
      <Modal isOpen={isLayersModalOpen} onClose={() => setIsLayersModalOpen(false)} title="Catchment Geographic Layers">
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">Enable or disable geographic layers displayed on the interactive catchment canvas:</p>
          <div className="space-y-2">
            {[
              { id: 'streams', name: 'Stream Network Vectors (Hydrography)', active: true },
              { id: 'stations', name: 'In-Situ Water Quality Sensors', active: true },
              { id: 'satellite', name: 'Sentinel-2 MSI Optical Composite', active: true },
              { id: 'catchments', name: 'Basin Catchment Watershed Boundaries', active: true },
            ].map((layer) => (
              <label key={layer.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:bg-slate-100/80 transition">
                <span className="font-semibold text-slate-800">{layer.name}</span>
                <input type="checkbox" defaultChecked={layer.active} className="rounded text-blue-600 focus:ring-blue-500" />
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
