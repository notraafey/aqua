import React, { useState } from 'react';
import { ForecastResult, ScenarioSimulation, ScenarioType, ScenarioComparison } from '@aquasentinel/shared';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Sliders, Sparkles, Layers, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ScenarioSimulatorViewProps {
  reachId: string;
  reachName: string;
  baselineForecast: ForecastResult | null;
  savedScenarios: ScenarioSimulation[];
  onScenarioSimulated: (simulation: ScenarioSimulation) => void;
}

export const ScenarioSimulatorView: React.FC<ScenarioSimulatorViewProps> = ({
  reachId,
  reachName,
  baselineForecast,
  savedScenarios,
  onScenarioSimulated,
}) => {
  const [scenarioType, setScenarioType] = useState<ScenarioType>('ACCELERATED_DETERIORATION');
  const [scenarioName, setScenarioName] = useState('');
  const [accelerationMultiplier, setAccelerationMultiplier] = useState(1.8);
  const [attenuationRate, setAttenuationRate] = useState(0.06);
  const [rainfallMm, setRainfallMm] = useState(35);
  const [interventionEfficacy, setInterventionEfficacy] = useState(40);
  const [interventionLagHours, setInterventionLagHours] = useState(12);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimulation, setActiveSimulation] = useState<ScenarioSimulation | null>(
    savedScenarios[0] || null
  );
  const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleSimulate = async () => {
    if (!baselineForecast) return;

    try {
      setIsSimulating(true);
      const params: Record<string, any> = {};
      if (scenarioType === 'ACCELERATED_DETERIORATION') params.accelerationMultiplier = accelerationMultiplier;
      if (scenarioType === 'ATTENUATION') params.attenuationRatePerDay = attenuationRate;
      if (scenarioType === 'WEATHER_EVENT') {
        params.rainfallIntensityMm = rainfallMm;
        params.runoffCoefficient = 0.45;
      }
      if (scenarioType === 'OPERATIONAL_INTERVENTION') {
        params.interventionEfficacyPercent = interventionEfficacy;
        params.interventionLagHours = interventionLagHours;
      }

      const res = await apiClient.runScenario(reachId, {
        type: scenarioType,
        name: scenarioName.trim() || undefined,
        baselineForecastId: baselineForecast.id,
        horizonHours: 72,
        parameters: params,
      });

      setActiveSimulation(res);
      onScenarioSimulated(res);
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCompareAll = async () => {
    if (savedScenarios.length === 0 || !baselineForecast) return;
    try {
      setIsComparing(true);
      const sIds = savedScenarios.map((s) => s.scenarioId);
      const comp = await apiClient.compareScenarios(reachId, sIds, baselineForecast.id);
      setComparison(comp);
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setIsComparing(false);
    }
  };

  // SVG Dual Trajectory Geometry
  const width = 740;
  const height = 240;
  const padding = { top: 25, right: 30, bottom: 35, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const steps = baselineForecast?.projections || [];
  const simSteps = activeSimulation?.projections || [];

  const allVals = [
    ...(steps.map((s) => s.projectedValue)),
    ...(simSteps.map((s) => s.projectedValue)),
    0.1,
  ];
  const minVal = Math.max(0, Math.min(...allVals) * 0.85);
  const maxVal = Math.max(0.3, Math.max(...allVals) * 1.15);

  const getX = (idx: number) => {
    const total = Math.max(steps.length, 1);
    return padding.left + (idx / total) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;
  };

  // Baseline path
  const baselinePath = steps.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx + 1)} ${getY(s.projectedValue)}`).join(' ');

  // Simulated path
  const simPath = simSteps.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx + 1)} ${getY(s.projectedValue)}`).join(' ');

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="text-amber-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">
              Scenario Simulation & What-If Analysis
            </h3>
            <Badge variant="amber" size="sm">SIMULATED</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Transparent hypothesis testing with explicit parameters. Simulated effects are separated from verified observations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedScenarios.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCompareAll}
              isLoading={isComparing}
            >
              <Layers size={14} className="mr-1" />
              Compare Scenarios ({savedScenarios.length})
            </Button>
          )}
        </div>
      </div>

      {/* Simulator Controls & Parameter Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-950/60 border border-slate-800 rounded-xl p-5">
        {/* Scenario Hypothesis Type */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
              Hypothesis Scenario Type
            </label>
            <select
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value as ScenarioType)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="ACCELERATED_DETERIORATION">Accelerated Deterioration</option>
              <option value="ATTENUATION">Natural Attenuation</option>
              <option value="WEATHER_EVENT">Meteorological Rainfall Shock</option>
              <option value="OPERATIONAL_INTERVENTION">Operational Intervention Effect</option>
              <option value="CURRENT_CONTINUES">Status Quo Continuation</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Custom Scenario Label (Optional)
            </label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g. Upstream Agricultural Flush + Heat"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Dynamic Parameter Sliders */}
        <div className="space-y-4">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Hypothesis Parameters
          </span>

          {scenarioType === 'ACCELERATED_DETERIORATION' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Acceleration Multiplier:</span>
                <span className="text-amber-400 font-bold">{accelerationMultiplier.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1.1"
                max="3.0"
                step="0.1"
                value={accelerationMultiplier}
                onChange={(e) => setAccelerationMultiplier(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <span className="text-[11px] text-slate-500 block">
                Simulates compounding deterioration (e.g. rising solar radiation + calm waters).
              </span>
            </div>
          )}

          {scenarioType === 'ATTENUATION' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Attenuation Rate / Day:</span>
                <span className="text-emerald-400 font-bold">{(attenuationRate * 100).toFixed(0)}% / d</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.20"
                step="0.01"
                value={attenuationRate}
                onChange={(e) => setAttenuationRate(parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <span className="text-[11px] text-slate-500 block">
                Simulates rapid post-shock recovery or flushing.
              </span>
            </div>
          )}

          {scenarioType === 'WEATHER_EVENT' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Rainfall Intensity (mm):</span>
                <span className="text-blue-400 font-bold">{rainfallMm} mm</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={rainfallMm}
                onChange={(e) => setRainfallMm(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500"
              />
              <span className="text-[11px] text-slate-500 block">
                Calculates acute wash-off pulse followed by dilution.
              </span>
            </div>
          )}

          {scenarioType === 'OPERATIONAL_INTERVENTION' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Intervention Efficacy:</span>
                  <span className="text-cyan-400 font-bold">{interventionEfficacy}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={interventionEfficacy}
                  onChange={(e) => setInterventionEfficacy(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Intervention Lag Time:</span>
                  <span className="text-cyan-400 font-bold">{interventionLagHours}h</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="48"
                  step="6"
                  value={interventionLagHours}
                  onChange={(e) => setInterventionLagHours(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <span className="text-[11px] text-slate-500 block">
                Models post-approval task execution impact (e.g. aeration or weir flushing).
              </span>
            </div>
          )}

          {scenarioType === 'CURRENT_CONTINUES' && (
            <p className="text-xs text-slate-400 italic">
              Status quo projection replicates the baseline forecasting model exactly without external perturbations.
            </p>
          )}
        </div>

        {/* Action Panel */}
        <div className="flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 lg:pl-5 space-y-3">
          <div className="text-xs space-y-2">
            <span className="font-semibold text-slate-400 uppercase tracking-wider block">
              Simulation Scope
            </span>
            <div className="text-slate-300">
              Target Reach: <strong className="text-slate-100">{reachName}</strong>
            </div>
            <div className="text-slate-300">
              Horizon: <strong className="text-slate-100">+72 Hours (3 Days)</strong>
            </div>
            <div className="text-slate-300">
              Baseline: <strong className="text-slate-100">{baselineForecast?.modelId || 'Persistence'}</strong>
            </div>
          </div>

          <Button
            onClick={handleSimulate}
            isLoading={isSimulating}
            className="w-full"
          >
            <Sparkles size={16} className="mr-1.5" />
            Run Scenario Simulation
          </Button>
        </div>
      </div>

      {/* Dual Trajectory Visualizer */}
      {activeSimulation && baselineForecast && (
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/60 space-y-4">
          <div className="flex flex-wrap items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-200 uppercase tracking-wider">
                Trajectory Comparison
              </span>
              <Badge variant="amber" size="sm">
                Scenario: {activeSimulation.name}
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-cyan-400 inline-block" />
                <span className="text-cyan-300">Baseline Forecast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" />
                <span className="text-amber-300 font-bold">Simulated Trajectory</span>
              </div>
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto max-h-[260px]"
            >
              {/* Grid */}
              {[0, 0.5, 1.0].map((frac) => {
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

              {/* Baseline Path */}
              {baselinePath && (
                <path
                  d={baselinePath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}

              {/* Simulated Path */}
              {simPath && (
                <path
                  d={simPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeDasharray="5 3"
                />
              )}

              {/* Baseline Points */}
              {steps.map((s, idx) => (
                <circle
                  key={`base-${idx}`}
                  cx={getX(idx + 1)}
                  cy={getY(s.projectedValue)}
                  r="3.5"
                  fill="#06b6d4"
                />
              ))}

              {/* Simulated Points */}
              {simSteps.map((s, idx) => (
                <circle
                  key={`sim-${idx}`}
                  cx={getX(idx + 1)}
                  cy={getY(s.projectedValue)}
                  r="4"
                  fill="#f59e0b"
                />
              ))}

              {/* Step Labels */}
              {steps.map((s, idx) => (
                <text
                  key={`lbl-${idx}`}
                  x={getX(idx + 1)}
                  y={height - padding.bottom + 18}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  +{s.stepHours}h
                </text>
              ))}
            </svg>
          </div>

          {/* Explicit Assumptions Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Explicit Modelled Assumptions
            </span>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {activeSimulation.assumptions.map((assumption, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Multi-Scenario Comparison Matrix */}
      {comparison && (
        <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-cyan-400" />
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Multi-Scenario Comparison Matrix
              </h4>
            </div>
            <Badge variant="cyan">{comparison.scenarios.length} Scenarios</Badge>
          </div>

          <p className="text-xs text-slate-300">
            {comparison.summary}
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-2.5">Horizon</th>
                  <th className="p-2.5">Baseline (NDCI)</th>
                  {comparison.scenarios.map((s) => (
                    <th key={s.scenarioId} className="p-2.5">
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {comparison.comparisonPoints.map((cp, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="p-2.5 text-slate-400 font-semibold">+{cp.stepHours}h</td>
                    <td className="p-2.5 text-cyan-300">{cp.baselineValue.toFixed(3)}</td>
                    {comparison.scenarios.map((s) => {
                      const delta = cp.deltas[s.name];
                      const val = cp.scenarioValues[s.name];
                      return (
                        <td key={s.scenarioId} className="p-2.5">
                          <span className="text-slate-200 font-bold">{val?.toFixed(3)}</span>
                          {delta && (
                            <span
                              className={`ml-2 text-[10px] ${
                                delta.percent > 0 ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {delta.percent > 0 ? '+' : ''}
                              {delta.percent}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Operational Implications */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Operational Implications
            </span>
            <ul className="space-y-1 text-xs text-slate-300">
              {comparison.operationalImplications.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
