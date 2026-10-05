import React, { useState } from 'react';
import { Observation, ForecastResult, AnalyticalProvenance } from '@aquasentinel/shared';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { AnalyticalProvenanceModal } from './AnalyticalProvenanceModal';
import { TrendingUp, GitBranch, Info } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ForecastChartViewProps {
  reachId: string;
  reachName: string;
  observations: Observation[];
  forecasts: ForecastResult[];
  onGenerateForecast: (reachId: string, modelId: string, horizonHours: number) => Promise<void>;
  typicalBaseline?: number;
}

export const ForecastChartView: React.FC<ForecastChartViewProps> = ({
  reachId,
  reachName,
  observations,
  forecasts,
  onGenerateForecast,
  typicalBaseline = 0.12,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('linear-trend-v1');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(72);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeProvenance, setActiveProvenance] = useState<AnalyticalProvenance | null>(null);
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [activeForecastIndex, setActiveForecastIndex] = useState<number>(0);

  const activeForecast = forecasts[activeForecastIndex] || forecasts[0] || null;

  // Filter historical NDCI observations
  const ndciObs = observations
    .filter((o) => o.indicator === 'NDCI')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Determine origin T
  const originTimestamp = activeForecast?.originTimestamp || (ndciObs.length > 0 ? ndciObs[ndciObs.length - 1].timestamp : new Date().toISOString());
  const originMs = new Date(originTimestamp).getTime();

  // Only historical observations <= T
  const historicalPoints = ndciObs.filter((o) => new Date(o.timestamp).getTime() <= originMs);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      await onGenerateForecast(reachId, selectedModel, selectedHorizon);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenProvenance = async () => {
    if (!activeForecast) return;
    try {
      const prov = await apiClient.getProvenance(activeForecast.id);
      setActiveProvenance(prov);
      setIsProvenanceOpen(true);
    } catch (err) {
      console.error('Failed to load provenance:', err);
    }
  };

  // SVG Chart Geometry Calculation
  const width = 800;
  const height = 320;
  const padding = { top: 30, right: 40, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Compute domain bounds
  const allValues: number[] = [
    typicalBaseline,
    ...historicalPoints.map((p) => (typeof p.value === 'number' ? p.value : parseFloat(String(p.value)) || 0)),
  ];

  if (activeForecast) {
    for (const proj of activeForecast.projections) {
      allValues.push(proj.projectedValue);
      allValues.push(proj.lowerBound);
      allValues.push(proj.upperBound);
    }
  }

  const minVal = Math.max(0, Math.min(...allValues) * 0.85);
  const maxVal = Math.max(0.35, Math.max(...allValues) * 1.15);

  const allTimestamps: number[] = [
    ...historicalPoints.map((p) => new Date(p.timestamp).getTime()),
  ];
  if (activeForecast) {
    allTimestamps.push(originMs);
    for (const p of activeForecast.projections) {
      allTimestamps.push(new Date(p.targetTimestamp).getTime());
    }
  }

  const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now() - 7 * 86400000;
  const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now() + 3 * 86400000;
  const timeSpan = maxTime - minTime || 1;

  const getX = (timestampMs: number) => {
    return padding.left + ((timestampMs - minTime) / timeSpan) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  };

  // Build SVG Paths
  // 1. Observed historical path
  const observedPath = historicalPoints.map((p, idx) => {
    const x = getX(new Date(p.timestamp).getTime());
    const y = getY(typeof p.value === 'number' ? p.value : parseFloat(String(p.value)) || 0);
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // 2. Projected path
  let projectedPath = '';
  let uncertaintyPolygon = '';

  if (activeForecast && activeForecast.projections.length > 0) {
    const originPoint = historicalPoints[historicalPoints.length - 1];
    const startX = getX(originMs);
    const startY = getY(activeForecast.currentValue || (originPoint ? (typeof originPoint.value === 'number' ? originPoint.value : parseFloat(String(originPoint.value)) || 0) : 0));

    const projCoords = activeForecast.projections.map((p) => ({
      x: getX(new Date(p.targetTimestamp).getTime()),
      y: getY(p.projectedValue),
      lowerY: getY(p.lowerBound),
      upperY: getY(p.upperBound),
    }));

    projectedPath = `M ${startX} ${startY} ` + projCoords.map((c) => `L ${c.x} ${c.y}`).join(' ');

    // Uncertainty polygon (envelope)
    const upperPoints = [`${startX},${startY}`, ...projCoords.map((c) => `${c.x},${c.upperY}`)];
    const lowerPoints = [...projCoords.map((c) => `${c.x},${c.lowerY}`).reverse(), `${startX},${startY}`];
    uncertaintyPolygon = [...upperPoints, ...lowerPoints].join(' ');
  }

  const baselineY = getY(typicalBaseline);
  const originX = getX(originMs);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header & Model Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-cyan-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">
              Short-Horizon Forecast: {reachName}
            </h3>
            {activeForecast && (
              <Badge variant="cyan" size="sm">
                Model: {activeForecast.modelId}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical time-series forecasting with anti-data leakage barrier at origin T
          </p>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Model:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="linear-trend-v1">OLS Linear Trend</option>
              <option value="ewma-damped-trend-v1">EWMA Damped Trend</option>
              <option value="baseline-persistence">Persistence Reference</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Horizon:</span>
            <select
              value={selectedHorizon}
              onChange={(e) => setSelectedHorizon(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value={24}>+24 Hours</option>
              <option value={48}>+48 Hours</option>
              <option value={72}>+72 Hours</option>
            </select>
          </div>

          {forecasts.length > 1 && (
            <select
              value={activeForecastIndex}
              onChange={(e) => setActiveForecastIndex(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              {forecasts.map((fc, i) => (
                <option key={fc.id} value={i}>
                  Run #{i + 1} ({fc.modelId})
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            onClick={handleGenerate}
            isLoading={isGenerating}
          >
            Compute Forecast
          </Button>

          {activeForecast && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenProvenance}
            >
              <GitBranch size={14} className="mr-1" />
              Provenance DAG
            </Button>
          )}
        </div>
      </div>

      {/* Scientific Proxy Disclosure Banner */}
      <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs">
        <Info size={16} className="text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-cyan-200/90">
          <strong className="text-cyan-300">Scientific Proxy Disclosure:</strong> Sentinel-2 NDCI is a remote sensing index measuring spectral chlorophyll pigment absorption. It is an indicative screening proxy and does not establish pathogen taxonomy, toxin presence, or regulatory water non-potability without in-situ laboratory assay confirmation.
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 relative overflow-hidden">
        {/* Chart Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs mb-3 text-slate-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              <span className="font-semibold text-cyan-300">OBSERVED</span> (Sentinel-2 / Sensor)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-amber-400 inline-block" />
              <span className="w-2 h-2 rounded-full border border-amber-400 inline-block" />
              <span className="font-semibold text-amber-300">PROJECTED</span> (Uncertainty Envelope)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dotted border-slate-500 inline-block" />
              <span className="text-slate-400">Typical Baseline ({typicalBaseline})</span>
            </div>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Origin T: {new Date(originTimestamp).toLocaleDateString()}
          </div>
        </div>

        {/* The SVG element */}
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto max-h-[380px]"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
              const val = minVal + frac * (maxVal - minVal);
              const y = getY(val);
              return (
                <g key={frac}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#1e293b"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {val.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Typical Baseline Horizontal Line */}
            <line
              x1={padding.left}
              y1={baselineY}
              x2={width - padding.right}
              y2={baselineY}
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 5}
              y={baselineY - 6}
              fill="#94a3b8"
              fontSize="10"
              textAnchor="end"
              fontFamily="monospace"
            >
              Baseline {typicalBaseline}
            </text>

            {/* Uncertainty Polygon Envelope */}
            {uncertaintyPolygon && (
              <polygon
                points={uncertaintyPolygon}
                fill="rgba(245, 158, 11, 0.12)"
                stroke="rgba(245, 158, 11, 0.3)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            )}

            {/* Historical Observed Series */}
            {observedPath && (
              <path
                d={observedPath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2.5"
              />
            )}

            {/* Projected Series */}
            {projectedPath && (
              <path
                d={projectedPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            )}

            {/* Historical Observation Dots */}
            {historicalPoints.map((p, idx) => {
              const x = getX(new Date(p.timestamp).getTime());
              const y = getY(typeof p.value === 'number' ? p.value : parseFloat(String(p.value)) || 0);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#06b6d4"
                  stroke="#083344"
                  strokeWidth="2"
                >
                  <title>{`[OBSERVED] ${p.source}: ${p.value} (${new Date(p.timestamp).toLocaleDateString()})`}</title>
                </circle>
              );
            })}

            {/* Projected Points Dots */}
            {activeForecast?.projections.map((p, idx) => {
              const x = getX(new Date(p.targetTimestamp).getTime());
              const y = getY(p.projectedValue);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#f59e0b"
                  stroke="#451a03"
                  strokeWidth="2"
                >
                  <title>{`[PROJECTED +${p.stepHours}h] ${p.projectedValue.toFixed(3)} [${p.lowerBound.toFixed(3)} - ${p.upperBound.toFixed(3)}]`}</title>
                </circle>
              );
            })}

            {/* Forecast Origin T Vertical Barrier */}
            <line
              x1={originX}
              y1={padding.top}
              x2={originX}
              y2={height - padding.bottom}
              stroke="#e2e8f0"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <rect
              x={originX - 45}
              y={padding.top - 16}
              width="90"
              height="16"
              rx="4"
              fill="#1e293b"
            />
            <text
              x={originX}
              y={padding.top - 4}
              fill="#f8fafc"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
              fontFamily="monospace"
            >
              Origin Barrier T
            </text>
          </svg>
        </div>
      </div>

      {/* Structured Factual Explanation Card */}
      {activeForecast && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 md:col-span-2 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Structured Factual Explanation
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">
              {activeForecast.explanation}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
              {activeForecast.labels.map((label) => (
                <Badge key={label} variant="slate" size="sm">
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider block">
              Trajectory Diagnostics
            </span>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Trend Classification:</span>
                <Badge variant={activeForecast.trend === 'ACCELERATING' ? 'rose' : activeForecast.trend === 'INCREASING' ? 'amber' : 'emerald'}>
                  {activeForecast.trend}
                </Badge>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Trend Slope / Day:</span>
                <span className="text-slate-200">
                  {activeForecast.trendSlopePerDay > 0 ? '+' : ''}
                  {(activeForecast.trendSlopePerDay * 100).toFixed(2)}% / d
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Uncertainty:</span>
                <span className="text-amber-400">{activeForecast.uncertainty}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Confidence Band:</span>
                <span className="text-cyan-400 font-bold">{activeForecast.confidence}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Provenance Modal */}
      <AnalyticalProvenanceModal
        isOpen={isProvenanceOpen}
        onClose={() => setIsProvenanceOpen(false)}
        provenance={activeProvenance}
      />
    </div>
  );
};
