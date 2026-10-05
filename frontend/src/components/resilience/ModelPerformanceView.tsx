import React, { useState } from 'react';
import { ModelEvaluationMetric } from '@aquasentinel/shared';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Award, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/client';

interface ModelPerformanceViewProps {
  reachId: string;
  reachName: string;
  metrics: ModelEvaluationMetric[];
  onBacktestCompleted: (newMetrics: ModelEvaluationMetric[]) => void;
}

export const ModelPerformanceView: React.FC<ModelPerformanceViewProps> = ({
  reachId,
  reachName,
  metrics,
  onBacktestCompleted,
}) => {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunBacktest = async () => {
    try {
      setIsRunning(true);
      const res = await apiClient.runBacktest({
        reachId,
        indicator: 'NDCI',
        modelIds: ['linear-trend-v1', 'ewma-damped-trend-v1'],
        horizons: [24, 48, 72],
      });
      onBacktestCompleted(res);
    } catch (err) {
      console.error('Failed to run backtest:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="text-cyan-400" size={20} />
            <h3 className="text-base font-bold text-slate-100">
              Model Performance & Rolling Holdout Backtests: {reachName}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historical out-of-sample backtesting against the Persistence Baseline reference model
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleRunBacktest}
          isLoading={isRunning}
        >
          <RefreshCw size={14} className="mr-1.5" />
          Run Rolling Backtest
        </Button>
      </div>

      {/* Rigorous Methodology Banner */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3 text-xs">
        <ShieldCheck size={18} className="text-emerald-400 mt-0.5 shrink-0" />
        <div className="text-slate-300">
          <strong className="text-slate-100">Rigorous Scientific Backtesting:</strong> Models are strictly evaluated on historical holdout points with zero future data leakage ($T_k$ barrier enforced). Performance metrics (MAE, RMSE, Directional Accuracy) are reported and benchmarked against persistence persistence to verify forecast skill.
        </div>
      </div>

      {/* Performance Metrics Table */}
      {metrics.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
          No historical model evaluations recorded yet for this reach. Click "Run Rolling Backtest" above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Model</th>
                <th className="p-3">Horizon</th>
                <th className="p-3 text-right">Holdout Sample</th>
                <th className="p-3 text-right">MAE</th>
                <th className="p-3 text-right">RMSE</th>
                <th className="p-3 text-right">Directional Acc.</th>
                <th className="p-3 text-right">vs Persistence Baseline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {metrics.map((m) => {
                const isBaseline = m.modelId === 'baseline-persistence';
                const comp = m.baselineModelComparison;

                return (
                  <tr key={m.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-3 font-sans font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <span>{m.modelName}</span>
                        {isBaseline ? (
                          <Badge variant="slate" size="sm">REFERENCE</Badge>
                        ) : (
                          <Badge variant="cyan" size="sm">{m.modelVersion}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-cyan-400 font-semibold">+{m.horizonHours}h</td>
                    <td className="p-3 text-right text-slate-400">{m.sampleSize} pts</td>
                    <td className="p-3 text-right text-slate-200 font-bold">{m.mae.toFixed(4)}</td>
                    <td className="p-3 text-right text-slate-200 font-bold">{m.rmse.toFixed(4)}</td>
                    <td className="p-3 text-right">
                      <span className="text-emerald-400 font-bold">
                        {m.directionalAccuracy.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {isBaseline ? (
                        <span className="text-slate-500 italic">Reference Baseline</span>
                      ) : comp ? (
                        <span
                          className={`font-bold ${
                            comp.improvementPercentMae >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {comp.improvementPercentMae >= 0 ? '+' : ''}
                          {comp.improvementPercentMae.toFixed(1)}% MAE
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
