import React, { useState } from 'react';
import { EarlyWarning } from '@aquasentinel/shared';
import { AlertTriangle, AlertCircle, ShieldAlert, ChevronRight, Info } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface EarlyWarningBannerProps {
  warnings: EarlyWarning[];
  onAcknowledge?: (warningId: string, notes?: string) => Promise<void>;
  onSelectReach?: (reachId: string) => void;
}

export const EarlyWarningBanner: React.FC<EarlyWarningBannerProps> = ({
  warnings,
  onAcknowledge,
  onSelectReach,
}) => {
  const [selectedWarning, setSelectedWarning] = useState<EarlyWarning | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (warnings.length === 0) return null;

  const handleOpenAcknowledge = (warning: EarlyWarning, e: React.MouseEvent) => {
    e.stopPropagation();
    setAcknowledgingId(warning.id);
    setOperatorNotes('');
  };

  const handleConfirmAcknowledge = async () => {
    if (!acknowledgingId || !onAcknowledge) return;
    try {
      setIsSubmitting(true);
      await onAcknowledge(acknowledgingId, operatorNotes);
      setAcknowledgingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityStyle = (level: EarlyWarning['warningLevel']) => {
    switch (level) {
      case 'WARNING':
        return {
          border: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
          badgeVariant: 'rose' as const,
          icon: ShieldAlert,
          iconColor: 'text-rose-400',
        };
      case 'ADVISORY':
        return {
          border: 'border-amber-800/80 bg-amber-950/40 text-amber-300',
          badgeVariant: 'amber' as const,
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
        };
      case 'WATCH':
      default:
        return {
          border: 'border-cyan-800/80 bg-cyan-950/40 text-cyan-300',
          badgeVariant: 'cyan' as const,
          icon: AlertCircle,
          iconColor: 'text-cyan-400',
        };
    }
  };

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-amber-400" size={18} />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Multi-Signal Early Warnings ({warnings.length})
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          Corroborated across satellite, weather, and in-situ sources
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {warnings.map((warning) => {
          const style = getSeverityStyle(warning.warningLevel);
          const Icon = style.icon;
          const isAcknowledged = (warning as any).acknowledged;

          return (
            <div
              key={warning.id}
              onClick={() => setSelectedWarning(warning)}
              className={`p-4 rounded-xl border ${style.border} cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={style.iconColor} size={18} />
                    <Badge variant={style.badgeVariant}>{warning.warningLevel}</Badge>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {warning.indicator}
                    </span>
                  </div>
                  {isAcknowledged && (
                    <Badge variant="slate" size="sm">ACKNOWLEDGED</Badge>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-slate-100 mb-1 line-clamp-1">
                  {warning.reachName}
                </h4>

                <p className="text-xs text-slate-300 line-clamp-2 mb-2">
                  {warning.triggerReason}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {warning.contributingFactors.slice(0, 2).map((factor, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-900/80 text-slate-400 border border-slate-800"
                    >
                      {factor}
                    </span>
                  ))}
                  {warning.contributingFactors.length > 2 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-500 border border-slate-800">
                      +{warning.contributingFactors.length - 2}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-auto text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  Confidence: <strong className="text-slate-200">{warning.confidence}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {!isAcknowledged && onAcknowledge && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleOpenAcknowledge(warning, e)}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {onSelectReach && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReach(warning.streamReachId);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 p-1"
                      title="View Reach Analytics"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Early Warning Detail Modal */}
      {selectedWarning && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedWarning(null)}
          title={`Early Warning: ${selectedWarning.reachName}`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={getSeverityStyle(selectedWarning.warningLevel).badgeVariant}>
                  {selectedWarning.warningLevel}
                </Badge>
                <span className="text-sm font-semibold text-slate-300">
                  Indicator: {selectedWarning.indicator}
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Detected: {new Date(selectedWarning.timestamp).toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Factual Trigger Rationale
              </span>
              <p className="text-sm text-slate-200">{selectedWarning.triggerReason}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Contributing Corroboration Signals
              </span>
              <ul className="space-y-1.5">
                {selectedWarning.contributingFactors.map((factor, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                    <Info size={14} className="text-cyan-400 mt-0.5 shrink-0" />
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-3">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider block mb-1">
                Recommended Operational Action
              </span>
              <p className="text-sm text-cyan-200">{selectedWarning.recommendedAction}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">
                Reach ID: {selectedWarning.streamReachId}
              </span>
              <div className="flex gap-2">
                {onSelectReach && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onSelectReach(selectedWarning.streamReachId);
                      setSelectedWarning(null);
                    }}
                  >
                    Open Reach Analytics
                  </Button>
                )}
                {!(selectedWarning as any).acknowledged && onAcknowledge && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      const w = selectedWarning;
                      setSelectedWarning(null);
                      handleOpenAcknowledge(w, e);
                    }}
                  >
                    Acknowledge Warning
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Acknowledge Notes Modal */}
      {acknowledgingId && (
        <Modal
          isOpen={true}
          onClose={() => setAcknowledgingId(null)}
          title="Acknowledge Early Warning"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Record acknowledgement of this early warning. Enter operational notes or action dispatch details:
            </p>
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold uppercase">
                Operator Notes
              </label>
              <textarea
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="e.g. Field investigation team scheduled; sampling bottles dispatched..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAcknowledgingId(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAcknowledge}
                isLoading={isSubmitting}
              >
                Confirm Acknowledgement
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
