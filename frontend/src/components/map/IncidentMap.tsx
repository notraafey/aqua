import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Layers,
  AlertTriangle,
  AlertOctagon,
  Activity,
  Compass,
  Eye,
  EyeOff,
} from 'lucide-react';
import { StreamReach, Incident, Task, Observation } from '@aquasentinel/shared';
import { Badge } from '../common/Badge.js';
import { Button } from '../common/Button.js';
import { Card } from '../common/Card.js';

interface IncidentMapProps {
  reaches: StreamReach[];
  incidents: Incident[];
  tasks?: Task[];
  observations?: Observation[];
  selectedReachId?: string | null;
  onSelectReach?: (reachId: string) => void;
  onSelectIncident?: (incidentId: string) => void;
  onSelectTask?: (taskId: string) => void;
  heightClass?: string;
  isCompact?: boolean;
}

function getLineCoordinates(reach: StreamReach): [number, number][] {
  if (!reach?.geometry) return [];
  if (reach.geometry.type === 'LineString') {
    return (reach.geometry.coordinates || []) as [number, number][];
  }
  if (reach.geometry.type === 'Point') {
    return [reach.geometry.coordinates as [number, number]];
  }
  if (reach.geometry.type === 'Polygon') {
    return (reach.geometry.coordinates[0] || []) as [number, number][];
  }
  return [];
}

export const IncidentMap: React.FC<IncidentMapProps> = ({
  reaches,
  incidents,
  tasks = [],
  observations = [],
  selectedReachId,
  onSelectReach,
  onSelectIncident,
  onSelectTask,
  heightClass = 'h-[520px]',
  isCompact: _isCompact = false,
}) => {
  // Layer toggles
  const [showReaches, setShowReaches] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showObservations, setShowObservations] = useState(false);
  const [activeReachId, setActiveReachId] = useState<string | null>(selectedReachId || null);

  // Volos Catchment Bounding Box & SVG Projector
  // Coordinates roughly ~22.72 to 22.78 Longitude, 39.15 to 39.22 Latitude
  const bounds = useMemo(() => {
    let minLon = 22.73;
    let maxLon = 22.77;
    let minLat = 39.16;
    let maxLat = 39.20;

    for (const r of reaches) {
      const coords = getLineCoordinates(r);
      for (const pt of coords) {
        if (pt[0] < minLon) minLon = pt[0];
        if (pt[0] > maxLon) maxLon = pt[0];
        if (pt[1] < minLat) minLat = pt[1];
        if (pt[1] > maxLat) maxLat = pt[1];
      }
    }

    // Add margin
    const lonPadding = (maxLon - minLon) * 0.15 || 0.01;
    const latPadding = (maxLat - minLat) * 0.15 || 0.01;

    return {
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding,
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
    };
  }, [reaches]);

  // Project longitude/latitude into SVG viewBox [0, 800] x [0, 500]
  const project = (coords: [number, number]): [number, number] => {
    const lon = coords[0];
    const lat = coords[1];
    const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 760 + 20;
    // Invert Y axis for SVG (north is up)
    const y = 480 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 440;
    return [Math.max(10, Math.min(790, x)), Math.max(10, Math.min(490, y))];
  };

  const currentActiveReach = reaches.find((r) => r.id === (activeReachId || selectedReachId));
  const reachIncidents = incidents.filter((i) => i.streamReachId === currentActiveReach?.id);
  const reachTasks = tasks.filter((t) => reachIncidents.some((i) => i.id === t.incidentId));

  const handleReachClick = (id: string) => {
    setActiveReachId(id);
    if (onSelectReach) onSelectReach(id);
  };

  const getSeverityIcon = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertOctagon size={12} className="text-white" />;
      case 'HIGH':
        return <AlertTriangle size={12} className="text-white" />;
      case 'MEDIUM':
        return <Activity size={12} className="text-white" />;
      default:
        return <MapPin size={12} className="text-white" />;
    }
  };

  const getSeverityColor = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return '#f43f5e'; // rose-500
      case 'HIGH':
        return '#f59e0b'; // amber-500
      case 'MEDIUM':
        return '#06b6d4'; // cyan-500
      default:
        return '#64748b'; // slate-500
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      {/* Interactive Map Canvas */}
      <div className={`relative flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl ${heightClass} flex flex-col`}>
        {/* Layer Controls Bar */}
        <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 p-1.5 rounded-xl shadow-lg text-xs">
          <div className="flex items-center gap-1 text-slate-400 font-mono px-1.5">
            <Layers size={13} className="text-cyan-400" />
            <span className="text-[11px] font-semibold uppercase">Layers</span>
          </div>

          <button
            type="button"
            onClick={() => setShowReaches(!showReaches)}
            className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
              showReaches
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {showReaches ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>Reaches ({reaches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIncidents(!showIncidents)}
            className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
              showIncidents
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {showIncidents ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>Incidents ({incidents.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTasks(!showTasks)}
            className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
              showTasks
                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {showTasks ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>Tasks ({tasks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowObservations(!showObservations)}
            className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${
              showObservations
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {showObservations ? <Eye size={12} /> : <EyeOff size={12} />}
            <span>Sensors ({observations.length})</span>
          </button>
        </div>

        {/* Catchment Title Beacon */}
        <div className="absolute top-3 right-3 z-20 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl text-right">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
            <Compass size={13} className="text-cyan-400" />
            <span>Volos Urban Catchment</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Pagasetic Gulf Drainage</span>
        </div>

        {/* SVG Projection Canvas */}
        <svg
          viewBox="0 0 800 500"
          className="w-full h-full object-cover select-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, #030712 0%, #020617 100%)' }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>

            {/* Glowing Stream Watercourse Filter */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width="800" height="500" fill="url(#grid)" />

          {/* Catchment Estuary Shoreline Visual Guide */}
          <path
            d="M 50 450 Q 250 420, 450 440 T 780 430"
            fill="none"
            stroke="#0f172a"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
          <text x="60" y="470" fill="#334155" fontSize="10" fontFamily="monospace">
            ▲ PAGASITIC GULF ESTUARY COASTLINE
          </text>

          {/* Stream Reach Paths */}
          {showReaches &&
            reaches.map((reach) => {
              const coords = getLineCoordinates(reach);
              if (coords.length < 2) return null;

              const projected = coords.map((c: any) => project(c));
              const pathD = projected.reduce(
                (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`,
                ''
              );

              const isSelected = reach.id === activeReachId;
              const hasIncident = incidents.some((i) => i.streamReachId === reach.id);

              return (
                <g
                  key={reach.id}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() => handleReachClick(reach.id)}
                >
                  {/* Invisible broad click target */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth="24" />

                  {/* Outer Reach Stroke Glow */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? '#22d3ee' : hasIncident ? '#f43f5e' : '#0284c7'}
                    strokeWidth={isSelected ? '7' : hasIncident ? '5' : '3.5'}
                    strokeOpacity={isSelected ? '0.8' : hasIncident ? '0.7' : '0.4'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={isSelected || hasIncident ? 'url(#glow-cyan)' : undefined}
                  />

                  {/* Core Stream Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isSelected ? '#a5f3fc' : hasIncident ? '#fda4af' : '#38bdf8'}
                    strokeWidth={isSelected ? '3' : '2'}
                    strokeLinecap="round"
                  />

                  {/* Reach Title Label */}
                  {projected.length > 0 && (
                    <text
                      x={projected[0][0] + 8}
                      y={projected[0][1] - 8}
                      fill={isSelected ? '#22d3ee' : '#94a3b8'}
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="system-ui, sans-serif"
                      className="pointer-events-none drop-shadow"
                    >
                      {reach.name.split('-')[0]}
                    </text>
                  )}
                </g>
              );
            })}

          {/* Observations Markers */}
          {showObservations &&
            observations.map((obs) => {
              const coords = obs.location?.coordinates;
              if (!coords) return null;
              const [x, y] = project(coords);

              return (
                <g key={obs.id} transform={`translate(${x}, ${y})`}>
                  <circle r="3.5" fill="#6366f1" opacity="0.8" />
                </g>
              );
            })}

          {/* Active Tasks Field Pins */}
          {showTasks &&
            tasks.map((task) => {
              const coords = task.location?.coordinates;
              if (!coords) return null;
              const [x, y] = project(coords);

              return (
                <g
                  key={task.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectTask) onSelectTask(task.id);
                  }}
                >
                  <circle r="6" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
                  <circle r="2" fill="#ffffff" />
                  <title>{`Task: ${task.title} (${task.status})`}</title>
                </g>
              );
            })}

          {/* Incident Beacons (PRD Section 7: accessible shape & icon) */}
          {showIncidents &&
            incidents.map((incident) => {
              const reach = reaches.find((r) => r.id === incident.streamReachId);
              const reachCoords = reach ? getLineCoordinates(reach) : [];
              const coords = reachCoords[1] || reachCoords[0] || [22.7535, 39.1812];
              const [x, y] = project(coords);
              const color = getSeverityColor(incident.severity);

              return (
                <g
                  key={incident.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSelectIncident) onSelectIncident(incident.id);
                    else handleReachClick(incident.streamReachId);
                  }}
                >
                  {/* Pulsating Beacon Ring */}
                  <circle r="14" fill={color} opacity="0.25" className="animate-ping" />
                  <circle r="10" fill={color} stroke="#0f172a" strokeWidth="2" />

                  {/* Icon in Center */}
                  <g transform="translate(-6, -6)">
                    {getSeverityIcon(incident.severity)}
                  </g>

                  {/* Accessible Label Card */}
                  <g transform="translate(14, -10)">
                    <rect
                      width="90"
                      height="22"
                      rx="6"
                      fill="#020617"
                      stroke={color}
                      strokeWidth="1"
                      opacity="0.9"
                    />
                    <text
                      x="6"
                      y="15"
                      fill="#f8fafc"
                      fontSize="9.5"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {incident.severity} • {incident.evidenceConfidence}%
                    </text>
                  </g>
                </g>
              );
            })}
        </svg>

        {/* Legend Overlay at Bottom */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-300">Operational Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span>Critical Anomaly</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>High Severity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <span>Monitored Reach</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>Active Field Task</span>
            </div>
          </div>

          <span className="font-mono text-[10px] text-slate-500">
            Click any reach to open operational inspector
          </span>
        </div>
      </div>

      {/* Contextual Reach & Incident Drawer (PRD Section 8) */}
      {currentActiveReach && (
        <Card className="w-full xl:w-80 p-4 space-y-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                  Selected Stream Reach
                </span>
                <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                  {currentActiveReach.name}
                </h4>
                <p className="text-[11px] text-slate-400">{currentActiveReach.city}, {currentActiveReach.region}</p>
              </div>
              <Badge variant="cyan" size="sm">
                {currentActiveReach.monitoringStatus}
              </Badge>
            </div>

            {/* Baseline Telemetry */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Historical Baseline</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Typical NDCI</span>
                  <span className="text-slate-200 font-bold">{currentActiveReach.baselineData?.typicalNdci ?? '0.12'}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Turbidity (NTU)</span>
                  <span className="text-slate-200 font-bold">{currentActiveReach.baselineData?.typicalTurbidity ?? '4.5'}</span>
                </div>
              </div>
            </div>

            {/* Active Incidents on this Reach */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center justify-between">
                <span>Active Incidents</span>
                <span className="font-mono text-cyan-400">{reachIncidents.length}</span>
              </span>

              {reachIncidents.length === 0 ? (
                <div className="p-3 bg-slate-900/50 rounded-xl text-slate-500 text-[11px] text-center border border-slate-800">
                  Operating within normal environmental baseline parameters.
                </div>
              ) : (
                reachIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => onSelectIncident && onSelectIncident(inc.id)}
                    className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">
                        {inc.hazardType.replace(/_/g, ' ')}
                      </span>
                      <Badge variant={inc.severity === 'CRITICAL' ? 'rose' : 'amber'} size="sm">
                        {inc.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Confidence: <strong className="text-cyan-400">{inc.evidenceConfidence}%</strong></span>
                      <span>{inc.status}</span>
                    </div>
                    {onSelectIncident && (
                      <div className="text-[10px] text-cyan-400 font-medium text-right pt-0.5">
                        Open Incident Detail →
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Active Tasks on this Reach */}
            {reachTasks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  Active Tasks ({reachTasks.length})
                </span>
                <div className="space-y-1.5">
                  {reachTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask && onSelectTask(t.id)}
                      className="p-2 bg-slate-900/60 border border-slate-800 rounded-lg flex items-center justify-between cursor-pointer hover:border-slate-700 transition"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-slate-300 block truncate">{t.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{t.assignedTo}</span>
                      </div>
                      <Badge variant="blue" size="sm">
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800">
            {reachIncidents[0] && onSelectIncident ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => onSelectIncident(reachIncidents[0].id)}
              >
                Inspect Incident Evidence & Actions →
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setActiveReachId(null)}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
