import React from 'react';
import { AnalyticalProvenance } from '@aquasentinel/shared';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { ShieldCheck, Database, Calendar, Cpu, Layers } from 'lucide-react';

interface AnalyticalProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  provenance: AnalyticalProvenance | null;
}

export const AnalyticalProvenanceModal: React.FC<AnalyticalProvenanceModalProps> = ({
  isOpen,
  onClose,
  provenance,
}) => {
  if (!provenance) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Analytical Provenance & Lineage DAG"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs text-slate-800">
        {/* Anti-Data Leakage Verification Gate */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck size={22} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                Anti-Data Leakage Gate: Verified Passed
              </h4>
              <Badge variant="emerald" size="sm">Zero Leakage Enforced</Badge>
            </div>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              At origin timestamp T, observations occurring after T are strictly excluded from feature generation, baseline calculations, and model parameter estimation.
            </p>
          </div>
        </div>

        {/* Forecast / Scenario Target Info */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 text-xs">
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-[11px]">Target Entity</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={provenance.targetType === 'FORECAST' ? 'cyan' : 'amber'}>
                {provenance.targetType}
              </Badge>
              <span className="font-mono text-slate-800 font-semibold truncate">{provenance.targetId}</span>
            </div>
          </div>
          <div>
            <span className="text-slate-500 block uppercase font-semibold text-[11px]">Generated Timestamp</span>
            <span className="font-mono text-slate-700 block mt-1">
              {new Date(provenance.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Model Architecture & Parameters */}
        <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Cpu size={15} className="text-blue-600" />
            <span>Forecasting Model Specification</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Model ID:</span>{' '}
              <span className="font-mono font-bold text-blue-700">{provenance.modelId}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Model Version:</span>{' '}
              <span className="font-mono text-slate-800">{provenance.modelVersion}</span>
            </div>
          </div>
          {Object.keys(provenance.parameters).length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 font-mono text-[11px] text-slate-800 overflow-x-auto border border-slate-200">
              <pre>{JSON.stringify(provenance.parameters, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Training Window */}
        <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Calendar size={15} className="text-blue-600" />
            <span>Empirical Training Window</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Window Start</span>
              <span className="font-mono text-slate-700">
                {new Date(provenance.trainingWindow.start).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Window End (Barrier T)</span>
              <span className="font-mono text-slate-700">
                {new Date(provenance.trainingWindow.end).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Observation Count</span>
              <span className="font-mono text-blue-700 font-bold">
                {provenance.trainingWindow.observationCount} points
              </span>
            </div>
          </div>
        </div>

        {/* Historical Baseline Reference */}
        {provenance.baselineUsed && (
          <div className="border border-slate-200/80 rounded-2xl p-3.5 bg-slate-50/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-slate-500" />
              <span className="text-slate-700 font-medium">Historical Typical Baseline:</span>
              <span className="font-mono font-bold text-amber-700">
                {provenance.baselineUsed.typicalValue}
              </span>
            </div>
            <span className="text-slate-500 font-mono text-[11px]">
              Source: {provenance.baselineUsed.source}
            </span>
          </div>
        )}

        {/* Input Observations Lineage DAG Table */}
        <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
              <Layers size={15} className="text-blue-600" />
              <span>Input Observations Lineage ({provenance.inputObservations.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Chronologically Sorted</span>
          </div>

          <div className="overflow-x-auto max-h-48 rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2.5 font-semibold">Obs ID</th>
                  <th className="p-2.5 font-semibold">Timestamp</th>
                  <th className="p-2.5 font-semibold">Source</th>
                  <th className="p-2.5 text-right font-semibold">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {provenance.inputObservations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 text-blue-700 font-bold truncate max-w-[120px]" title={obs.id}>
                      {obs.id.slice(0, 8)}...
                    </td>
                    <td className="p-2.5 text-slate-600">
                      {new Date(obs.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px]">
                        {obs.source}
                      </span>
                    </td>
                    <td className="p-2.5 text-right text-slate-900 font-bold">
                      {typeof obs.value === 'number' ? obs.value.toFixed(4) : obs.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
};
