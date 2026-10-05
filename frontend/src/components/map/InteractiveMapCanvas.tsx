import React, { useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Compass,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { StreamReach, Incident, Task, Observation } from '@aquasentinel/shared';
import { formatRelativeTime } from '../../utils/date.js';

export interface CatchmentData {
  id: string;
  name: string;
  code: string;
  description: string;
  reachesCount: number;
  stationsCount: number;
  networkStatus: 'Healthy' | 'Watch' | 'Critical';
  latestEvidence: string;
  activeIncidentsCount: number;
  lastUpdated: string;
  area: string;
  landUse: string;
  downstream: string;
  polygonPath: string; // SVG path data
  center: [number, number]; // [x, y] for label
  reachIds: string[];
}

export const BASE_CATCHMENTS = [
  {
    id: 'CAT-001',
    name: 'Upper River Catchment',
    code: 'CAT-001',
    description: 'Upper catchment supplying the upper river system. Includes forested headwaters and mountainous terrain.',
    area: '312 km²',
    landUse: 'Forest / Protected',
    downstream: 'Central Catchment (CAT-003)',
    polygonPath: 'M 380,120 C 420,100 480,110 520,130 C 580,160 590,220 570,270 C 550,310 490,340 430,320 C 390,300 370,250 360,200 Z',
    center: [470, 210] as [number, number],
    reachIds: ['RCH-014', 'RCH-015', 'RCH-016', 'RCH-017'],
  },
  {
    id: 'CAT-002',
    name: 'North Ridge Catchment',
    code: 'CAT-002',
    description: 'High-elevation catchment feeding the northern tributaries with steep runoff gradients.',
    area: '245 km²',
    landUse: 'Alpine / Forest',
    downstream: 'Upper River Catchment (CAT-001)',
    polygonPath: 'M 280,30 C 350,20 440,30 480,70 C 500,100 450,130 380,120 C 330,110 290,70 280,30 Z',
    center: [380, 75] as [number, number],
    reachIds: ['RCH-006', 'RCH-008'],
  },
  {
    id: 'CAT-004',
    name: 'West Valley Catchment',
    code: 'CAT-004',
    description: 'Agricultural valley with dense sensor telemetry and seasonal irrigation return flows.',
    area: '188 km²',
    landUse: 'Agricultural / Mixed',
    downstream: 'Upper River Catchment (CAT-001)',
    polygonPath: 'M 130,160 C 200,140 280,170 300,220 C 310,270 260,340 180,330 C 120,320 100,230 130,160 Z',
    center: [200, 240] as [number, number],
    reachIds: ['RCH-004', 'RCH-010'],
  },
  {
    id: 'CAT-003',
    name: 'Central Catchment',
    code: 'CAT-003',
    description: 'Urban municipal confluence receiving upstream flows from headwaters and agricultural zones.',
    area: '420 km²',
    landUse: 'Urban / Industrial',
    downstream: 'Lower River Catchment (CAT-006)',
    polygonPath: 'M 260,330 C 340,320 420,330 450,380 C 470,440 400,510 320,500 C 250,490 220,410 260,330 Z',
    center: [340, 420] as [number, number],
    reachIds: ['RCH-013', 'RCH-014', 'RCH-015'],
  },
  {
    id: 'CAT-005',
    name: 'East Foothills Catchment',
    code: 'CAT-005',
    description: 'Forested hills and eastern tributary tributaries connecting into the main lower river corridor.',
    area: '165 km²',
    landUse: 'Forest / Wilderness',
    downstream: 'Lower River Catchment (CAT-006)',
    polygonPath: 'M 560,180 C 620,160 690,190 710,250 C 720,310 660,370 590,360 C 560,340 550,260 560,180 Z',
    center: [640, 260] as [number, number],
    reachIds: ['RCH-017'],
  },
  {
    id: 'CAT-006',
    name: 'Lower River Catchment',
    code: 'CAT-006',
    description: 'Estuary transition zone draining into the bay, subject to tidal mixing and maritime traffic.',
    area: '290 km²',
    landUse: 'Coastal / Port',
    downstream: 'Coastal Embayment (Bay)',
    polygonPath: 'M 520,360 C 600,350 670,390 690,460 C 700,530 630,580 540,560 C 490,530 480,440 520,360 Z',
    center: [600, 460] as [number, number],
    reachIds: ['RCH-021'],
  },
];

export interface MapStation {
  id: string;
  name: string;
  x: number;
  y: number;
  status: 'Normal' | 'Watch' | 'Alert' | 'Incident' | 'Degraded';
  reachId: string;
  catchmentId: string;
  details?: string;
  incidentsCount?: number;
}

export const BASE_STATIONS: Omit<MapStation, 'status' | 'details' | 'incidentsCount'>[] = [
  { id: 'ST-01', name: 'Basin Headwaters Sensor', x: 420, y: 195, reachId: 'RCH-014', catchmentId: 'CAT-001' },
  { id: 'ST-02', name: 'Lower Reach Sensor', x: 480, y: 240, reachId: 'RCH-014', catchmentId: 'CAT-001' },
  { id: 'ST-03', name: 'North Ridge Inflow', x: 350, y: 80, reachId: 'RCH-006', catchmentId: 'CAT-002' },
  { id: 'ST-04', name: 'North Stream Confluence', x: 375, y: 140, reachId: 'RCH-006', catchmentId: 'CAT-002' },
  { id: 'ST-05', name: 'West Valley Branch', x: 190, y: 240, reachId: 'RCH-004', catchmentId: 'CAT-004' },
  { id: 'ST-06', name: 'Western Tributary Mid', x: 230, y: 280, reachId: 'RCH-004', catchmentId: 'CAT-004' },
  { id: 'ST-07', name: 'Central Urban Inflow', x: 330, y: 360, reachId: 'RCH-013', catchmentId: 'CAT-003' },
  { id: 'ST-08', name: 'Central Main Station', x: 365, y: 440, reachId: 'RCH-015', catchmentId: 'CAT-003' },
  { id: 'ST-09', name: 'East Foothills Junction', x: 610, y: 290, reachId: 'RCH-017', catchmentId: 'CAT-005' },
  { id: 'ST-10', name: 'East Tributary Station', x: 670, y: 340, reachId: 'RCH-017', catchmentId: 'CAT-005' },
  { id: 'ST-11', name: 'Lower River Trunk', x: 550, y: 400, reachId: 'RCH-021', catchmentId: 'CAT-006' },
  { id: 'ST-12', name: 'Delta Estuary Outfall', x: 650, y: 510, reachId: 'RCH-021', catchmentId: 'CAT-006' },
];

export function buildDynamicCatchments(
  reaches: StreamReach[] = [],
  incidents: Incident[] = [],
  observations: Observation[] = []
): CatchmentData[] {
  return BASE_CATCHMENTS.map((base) => {
    const catchmentReaches = reaches.filter((r) => base.reachIds.includes(r.id));
    const catchmentIncidents = incidents.filter(
      (i) => base.reachIds.includes(i.streamReachId) && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
    );
    const stationCount = BASE_STATIONS.filter((s) => s.catchmentId === base.id).length;

    let networkStatus: 'Healthy' | 'Watch' | 'Critical' = 'Healthy';
    if (catchmentIncidents.some((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH')) {
      networkStatus = 'Critical';
    } else if (catchmentIncidents.length > 0) {
      networkStatus = 'Watch';
    }

    const activeObs = observations
      .filter((o) => o.streamReachId && base.reachIds.includes(o.streamReachId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latestEvidence = catchmentIncidents.length > 0
      ? `${catchmentIncidents.length} active incident${catchmentIncidents.length > 1 ? 's' : ''}`
      : activeObs.length > 0
      ? `Latest: ${activeObs[0].indicator} (${activeObs[0].value} ${activeObs[0].unit})`
      : 'All telemetry nominal';

    const lastUpdated = activeObs.length > 0
      ? formatRelativeTime(activeObs[0].timestamp)
      : 'Telemetry active';

    return {
      ...base,
      reachesCount: catchmentReaches.length || base.reachIds.length,
      stationsCount: stationCount,
      networkStatus,
      latestEvidence,
      activeIncidentsCount: catchmentIncidents.length,
      lastUpdated,
    };
  });
}

export function buildDynamicStations(
  reaches: StreamReach[] = [],
  incidents: Incident[] = [],
  observations: Observation[] = []
): MapStation[] {
  return BASE_STATIONS.map((base, idx) => {
    const reach = reaches.find((r) => r.id === base.reachId) || (reaches.length > 0 ? reaches[idx % reaches.length] : undefined);
    const reachIdToMatch = reach?.id || base.reachId;
    const reachIncidents = incidents.filter(
      (i) => i.streamReachId === reachIdToMatch && i.status !== 'RESOLVED' && i.status !== 'DISMISSED'
    );
    const reachObs = observations
      .filter((o) => o.streamReachId === reachIdToMatch)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    let status: 'Normal' | 'Watch' | 'Alert' | 'Incident' | 'Degraded' = 'Normal';
    let details = 'Online • Nominal baseline';

    if (reachIncidents.length > 0) {
      const primary = reachIncidents[0];
      if (primary.severity === 'CRITICAL') {
        status = 'Incident';
      } else if (primary.severity === 'HIGH') {
        status = 'Alert';
      } else {
        status = 'Watch';
      }
      details = `${primary.hazardType.replace(/_/g, ' ')} (${primary.severity})`;
    } else if (reachObs.length > 0) {
      const latest = reachObs[0];
      details = `${latest.indicator}: ${latest.value} ${latest.unit}`;
    } else if (reach?.baselineData?.typicalTurbidity) {
      details = `Baseline turbidity: ${reach.baselineData.typicalTurbidity} NTU`;
    }

    const name = reach?.name ? `${reach.name} (${base.id})` : base.name;

    return {
      id: base.id,
      name,
      x: base.x,
      y: base.y,
      reachId: reachIdToMatch,
      catchmentId: base.catchmentId,
      status,
      details,
      incidentsCount: reachIncidents.length > 0 ? reachIncidents.length : undefined,
    };
  });
}

export const CATCHMENTS_DATA: CatchmentData[] = buildDynamicCatchments();
export const STATIONS_DATA: MapStation[] = buildDynamicStations();

export interface InteractiveMapCanvasProps {
  mode?: 'overview' | 'reaches' | 'catchments';
  selectedReachId?: string | null;
  selectedCatchmentId?: string | null;
  onSelectReach?: (reachId: string) => void;
  onSelectCatchment?: (catchmentId: string) => void;
  reaches?: StreamReach[];
  incidents?: Incident[];
  tasks?: Task[];
  observations?: Observation[];
  heightClass?: string;
  onExploreNetwork?: () => void;
  onViewFullMap?: () => void;
}

export const InteractiveMapCanvas: React.FC<InteractiveMapCanvasProps> = ({
  mode = 'overview',
  selectedReachId = null,
  selectedCatchmentId = null,
  onSelectReach,
  onSelectCatchment,
  reaches = [],
  incidents = [],
  tasks: _tasks = [],
  observations = [],
  heightClass = 'h-[360px]',
  onExploreNetwork,
  onViewFullMap,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activePopupStation, setActivePopupStation] = useState<MapStation | null>(null);

  const dynamicStations = useMemo(() => {
    return buildDynamicStations(reaches, incidents, observations);
  }, [reaches, incidents, observations]);

  const dynamicCatchments = useMemo(() => {
    return buildDynamicCatchments(reaches, incidents, observations);
  }, [reaches, incidents, observations]);

  const activeReachCode = useMemo(() => {
    if (!selectedReachId) return reaches[0]?.id || '';
    if (selectedReachId.startsWith('RCH-')) return selectedReachId;
    const match = reaches.find((r) => r.id === selectedReachId);
    return match ? (match.name.includes('RCH-') ? match.name.split(' ')[0] : match.id) : (reaches[0]?.id || '');
  }, [selectedReachId, reaches]);

  const handleZoomIn = () => setZoomLevel((z) => Math.min(1.6, z + 0.15));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.85, z - 0.15));

  const getStatusColor = (status: MapStation['status']) => {
    switch (status) {
      case 'Normal':
        return '#10b981'; // emerald-500
      case 'Watch':
        return '#f59e0b'; // amber-500
      case 'Alert':
        return '#f97316'; // orange-500
      case 'Incident':
      case 'Degraded':
        return '#ef4444'; // red-500
      default:
        return '#3b82f6';
    }
  };

  return (
    <div className={clsx('relative w-full rounded-2xl overflow-hidden bg-[#e8f1ec] border border-slate-200/90 shadow-inner select-none', heightClass)}>
      {/* Topographic Background Texture and Contours */}
      <svg
        viewBox="0 0 800 580"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
      >
        <defs>
          {/* Subtle Topo Gradient */}
          <linearGradient id="topoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ddece3" />
            <stop offset="50%" stopColor="#e3ede7" />
            <stop offset="100%" stopColor="#d5e6dc" />
          </linearGradient>

          {/* Catchment Selected Gradient */}
          <linearGradient id="selectedCatchmentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.30" />
          </linearGradient>

          {/* River Glow Filter */}
          <filter id="riverGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Incident Pulse Filter */}
          <filter id="beaconGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Base Background Surface */}
        <rect width="800" height="580" fill="url(#topoGradient)" />

        {/* Subtle Topographic Mountain / Valley Elevation Contours */}
        <g stroke="#b8d4c2" strokeWidth="0.75" fill="none" opacity="0.65">
          <path d="M 0,80 Q 200,60 400,120 T 800,90" />
          <path d="M 0,160 Q 250,130 500,200 T 800,180" />
          <path d="M 0,260 Q 180,240 380,310 T 800,280" />
          <path d="M 0,380 Q 300,340 550,420 T 800,390" />
          <path d="M 0,490 Q 220,460 460,530 T 800,480" />
          <circle cx="160" cy="180" r="90" strokeDasharray="3 4" opacity="0.4" />
          <circle cx="680" cy="220" r="110" strokeDasharray="3 4" opacity="0.4" />
          <circle cx="340" cy="450" r="80" strokeDasharray="3 4" opacity="0.4" />
        </g>

        {/* Catchment Polygons (Spatial Boundaries) */}
        {dynamicCatchments.map((catchment) => {
          const isSelected = catchment.id === selectedCatchmentId;
          return (
            <g
              key={catchment.id}
              className="cursor-pointer transition-all duration-200"
              onClick={() => onSelectCatchment?.(catchment.id)}
            >
              <path
                d={catchment.polygonPath}
                fill={isSelected ? 'url(#selectedCatchmentGrad)' : 'rgba(255, 255, 255, 0.28)'}
                stroke={isSelected ? '#2563eb' : '#ffffff'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeDasharray={isSelected ? undefined : '5 4'}
                className="transition-colors hover:fill-blue-100/40"
              />
              {/* Catchment Name Label */}
              <text
                x={catchment.center[0]}
                y={catchment.center[1]}
                textAnchor="middle"
                fontSize={isSelected ? '13' : '11'}
                fontWeight={isSelected ? '700' : '600'}
                fill={isSelected ? '#1e3a8a' : '#475569'}
                letterSpacing="0.02em"
                className="pointer-events-none select-none drop-shadow-sm font-sans"
              >
                {catchment.name}
              </text>
            </g>
          );
        })}

        {/* River Corridors & Main River Channels */}
        {/* River Channel Bed (Outer Soft Water Corridor) */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* North Tributary to Main River */}
          <path
            d="M 330,40 Q 360,110 390,165"
            stroke="#93c5fd"
            strokeWidth="8"
            opacity="0.7"
          />
          {/* West Tributary to Upper River */}
          <path
            d="M 120,200 Q 180,240 260,260 T 400,220"
            stroke="#93c5fd"
            strokeWidth="9"
            opacity="0.7"
          />
          {/* Main River Trunk: Upper River -> Central -> Lower River Delta */}
          <path
            d="M 390,165 Q 420,200 460,225 T 530,280 T 570,360 T 630,480 T 680,560"
            stroke="#93c5fd"
            strokeWidth="14"
            opacity="0.75"
          />
          {/* East Foothills Tributary */}
          <path
            d="M 680,240 Q 640,310 580,360"
            stroke="#93c5fd"
            strokeWidth="7"
            opacity="0.7"
          />
          {/* Central Southern Inflow */}
          <path
            d="M 340,510 Q 355,440 400,380 T 540,320"
            stroke="#93c5fd"
            strokeWidth="7"
            opacity="0.7"
          />

          {/* Active Flowing River Centerlines (Vibrant Blue Core) */}
          <path
            d="M 330,40 Q 360,110 390,165"
            stroke="#2563eb"
            strokeWidth="4"
          />
          <path
            d="M 120,200 Q 180,240 260,260 T 400,220"
            stroke="#2563eb"
            strokeWidth="4.5"
          />
          <path
            d="M 390,165 Q 420,200 460,225 T 530,280 T 570,360 T 630,480 T 680,560"
            stroke="#1d4ed8"
            strokeWidth="7"
          />
          <path
            d="M 680,240 Q 640,310 580,360"
            stroke="#2563eb"
            strokeWidth="3.5"
          />
          <path
            d="M 340,510 Q 355,440 400,380 T 540,320"
            stroke="#2563eb"
            strokeWidth="3.5"
          />
        </g>

        {/* Selected Reach Highlighting */}
        <g>
          <path
            d="M 400,200 Q 440,220 480,235"
            fill="none"
            stroke="#1e40af"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Flow Arrows */}
          <path
            d="M 465,225 L 475,230 L 465,235 Z"
            fill="#ffffff"
          />
          <path
            d="M 585,395 L 595,405 L 585,410 Z"
            fill="#ffffff"
          />
        </g>

        {/* Reach ID Floating Badges (as in aqua2 and aqua3) */}
        {mode !== 'overview' && (
          <g className="select-none pointer-events-none">
            {/* RCH-006 */}
            <rect x="330" y="45" width="56" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <text x="358" y="58" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">RCH-006</text>

            {/* RCH-004 */}
            <rect x="235" y="235" width="56" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <text x="263" y="248" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">RCH-004</text>

            {/* RCH-010 */}
            <rect x="260" y="325" width="56" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <text x="288" y="338" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">RCH-010</text>

            {/* Selected Reach Badge */}
            <rect x="440" y="195" width="68" height="22" rx="11" fill="#2563eb" filter="drop-shadow(0 2px 4px rgba(37,99,235,0.3))" />
            <text x="474" y="210" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffffff">
              {activeReachCode}
            </text>

            {/* RCH-017 */}
            <rect x="520" y="325" width="56" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <text x="548" y="338" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">RCH-017</text>

            {/* RCH-021 */}
            <rect x="635" y="375" width="56" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <text x="663" y="388" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">RCH-021</text>
          </g>
        )}

        {/* Monitoring Stations & Sensor Beacons */}
        {dynamicStations.map((station) => {
          const isIncident = station.status === 'Incident' || station.status === 'Alert';
          const color = getStatusColor(station.status);

          return (
            <g
              key={station.id}
              className="cursor-pointer group"
              onClick={() => {
                setActivePopupStation(station);
                onSelectReach?.(station.reachId);
                onSelectCatchment?.(station.catchmentId);
              }}
            >
              {/* Outer Pulsing Ping for Incident */}
              {isIncident && (
                <circle
                  cx={station.x}
                  cy={station.y}
                  r="14"
                  fill="#ef4444"
                  opacity="0.25"
                  className="animate-ping"
                />
              )}

              {/* Station Outer Ring */}
              <circle
                cx={station.x}
                cy={station.y}
                r="7"
                fill="#ffffff"
                stroke={color}
                strokeWidth="2.5"
                className="transition-transform group-hover:scale-125"
              />

              {/* Inner Center Dot */}
              <circle
                cx={station.x}
                cy={station.y}
                r="3"
                fill={color}
              />
            </g>
          );
        })}

        {/* Active Incident Warning Triangle Icons dynamically placed on incident stations */}
        {dynamicStations
          .filter((s) => s.status === 'Incident' || s.status === 'Alert')
          .map((station) => (
            <g
              key={`alert-icon-${station.id}`}
              transform={`translate(${station.x - 10}, ${station.y - 25})`}
              className="cursor-pointer filter drop-shadow-md"
              onClick={() => {
                setActivePopupStation(station);
                onSelectReach?.(station.reachId);
              }}
            >
              <circle cx="10" cy="10" r="11" fill="#ef4444" />
              <path
                d="M 10,4 L 16,15 L 4,15 Z"
                fill="#ffffff"
              />
              <circle cx="10" cy="12.5" r="1" fill="#ef4444" />
            </g>
          ))}
      </svg>

      {/* Floating Interactive Tooltip / Node Popup (as shown in aqua1) */}
      {activePopupStation && (
        <div
          className="absolute z-20 bg-white rounded-xl shadow-lg border border-slate-200/90 px-3.5 py-2.5 flex items-center gap-3 transition-all animate-in fade-in"
          style={{
            left: `${Math.min(75, Math.max(20, (activePopupStation.x / 800) * 100))}%`,
            top: `${Math.min(70, Math.max(15, (activePopupStation.y / 580) * 100 - 14))}%`,
          }}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-slate-900">{activePopupStation.name}</span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getStatusColor(activePopupStation.status) }}
              />
            </div>
            <p className="text-[11px] text-slate-500">{activePopupStation.details || 'Active monitoring point'}</p>
            {activePopupStation.incidentsCount && (
              <p className="text-[10px] font-semibold text-red-600 mt-0.5">
                {activePopupStation.incidentsCount} related incidents
              </p>
            )}
          </div>
          <button
            onClick={() => {
              onSelectReach?.(activePopupStation.reachId);
              onExploreNetwork?.();
            }}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Map Legend Overlay (Top Left) */}
      <div className="absolute top-3.5 left-3.5 bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200/80 p-2.5 shadow-sm text-[11px] space-y-1.5 text-slate-600 z-10">
        {mode === 'catchments' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-2.5 rounded bg-blue-100 border border-blue-400" />
              <span>Catchment boundary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-blue-600 rounded" />
              <span>Monitored reach</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-blue-700 rounded" />
              <span>Selected reach</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 bg-white" />
              <span>Monitoring station</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-red-500" />
              <span>Active incident</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Watch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>Alert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>{mode === 'reaches' ? 'Degraded' : 'Incident'}</span>
            </div>
            {mode === 'reaches' && (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-600 bg-white" />
                <span>Monitoring station</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compass Rose (Top Right) */}
      <div className="absolute top-3.5 right-3.5 bg-white/95 rounded-full p-2 shadow-sm border border-slate-200/80 flex flex-col items-center z-10">
        <span className="text-[9px] font-bold text-slate-700 -mb-0.5">N</span>
        <Compass size={16} className="text-slate-500" />
      </div>

      {/* Scale Bar (Bottom Left) */}
      <div className="absolute bottom-3.5 left-3.5 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-slate-600 font-mono shadow-sm border border-slate-200/80 z-10 flex items-center gap-2">
        <div className="flex flex-col items-center">
          <div className="flex justify-between w-20 text-[9px] text-slate-500">
            <span>0</span>
            <span>5</span>
            <span>10</span>
            <span>20 km</span>
          </div>
          <div className="w-20 h-1 bg-slate-300 border-x border-slate-600 flex">
            <div className="w-1/2 h-full bg-slate-700" />
          </div>
        </div>
      </div>

      {/* Zoom Controls (Bottom Right) */}
      <div className="absolute bottom-3.5 right-3.5 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden z-10">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-slate-50 text-slate-600 border-b border-slate-200/70 transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-slate-50 text-slate-600 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
      </div>

      {/* Overview Page Specific Action Buttons */}
      {mode === 'overview' && (
        <div className="absolute bottom-3.5 right-14 z-10">
          <button
            onClick={onViewFullMap}
            className="bg-white/95 hover:bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-1.5 transition-all"
          >
            <span>View full map</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
};
