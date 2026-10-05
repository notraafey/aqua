import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { ShieldCheck, AlertTriangle, HelpCircle, CheckCircle, ArrowUpRight } from 'lucide-react';
import { OperationalOutcomeType } from '@aquasentinel/shared';

interface OutcomeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  proposedOutcome?: string;
  reason?: string;
  confidence?: number;
  onConfirm: (outcomeType: OperationalOutcomeType, notes: string) => Promise<void>;
}

export const OutcomeReviewModal: React.FC<OutcomeReviewModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  proposedOutcome = 'CONFIRMED',
  reason,
  confidence,
  onConfirm,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<OperationalOutcomeType>(
    (proposedOutcome as OperationalOutcomeType) || 'CONFIRMED'
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (proposedOutcome) {
      setSelectedOutcome(proposedOutcome as OperationalOutcomeType);
    }
    setNotes('');
    setError(null);
  }, [proposedOutcome, isOpen]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(selectedOutcome, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm incident outcome');
    } finally {
      setSubmitting(false);
    }
  };

  const outcomeOptions: Array<{
    value: OperationalOutcomeType;
    label: string;
    description: string;
    icon: React.ReactNode;
    variant: 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
    activeClasses: string;
  }> = [
    {
      value: 'CONFIRMED',
      label: 'Confirmed Contamination',
      description: 'Physical ground presence verified. Proceed with active containment and remediation.',
      icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
      variant: 'emerald',
      activeClasses: 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs',
    },
    {
      value: 'NOT_CONFIRMED',
      label: 'False Alarm (Not Confirmed)',
      description: 'Inspection confirms clean water. Remote optical alert was uncorroborated.',
      icon: <ShieldCheck className="w-4 h-4 text-sky-600" />,
      variant: 'cyan',
      activeClasses: 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-500/20 shadow-xs',
    },
    {
      value: 'ADDITIONAL_VERIFICATION_REQUIRED',
      label: 'Additional Verification Required',
      description: 'Observations inconclusive. Queue secondary sampling or upstream investigation.',
      icon: <HelpCircle className="w-4 h-4 text-amber-600" />,
      variant: 'amber',
      activeClasses: 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20 shadow-xs',
    },
    {
      value: 'ESCALATE',
      label: 'Escalate to Critical Emergency',
      description: 'Severe acute ecological hazard observed (e.g. major fish mortality / chemical spill).',
      icon: <ArrowUpRight className="w-4 h-4 text-rose-600" />,
      variant: 'rose',
      activeClasses: 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-500/20 shadow-xs',
    },
    {
      value: 'UNCERTAIN',
      label: 'Uncertain / Under Review',
      description: 'Insufficient multi-modal evidence to take operational action.',
      icon: <AlertTriangle className="w-4 h-4 text-purple-600" />,
      variant: 'violet',
      activeClasses: 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-500/20 shadow-xs',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review & Confirm Operational Outcome"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Confirming...' : 'Confirm Operational Decision'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 py-1">
        {/* System Proposal Banner */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              System Recommendation • <span className="font-mono font-bold text-blue-700">{incidentId.slice(0, 8)}</span>
            </span>
            <div className="flex items-center gap-2">
              {confidence !== undefined && (
                <span className="text-xs text-slate-500 font-mono">
                  Confidence: <strong className="text-slate-900 font-semibold">{confidence}%</strong>
                </span>
              )}
              <Badge variant="cyan" size="sm">
                {proposedOutcome}
              </Badge>
            </div>
          </div>
          {reason && <p className="text-xs text-slate-700 leading-relaxed font-medium">{reason}</p>}
        </div>

        {/* Outcome Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Select Operational Outcome
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {outcomeOptions.map((opt) => {
              const isSelected = selectedOutcome === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => setSelectedOutcome(opt.value)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? opt.activeClasses
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="mt-0.5">{opt.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                        {opt.label}
                      </span>
                      <Badge variant={opt.variant} size="sm">
                        {opt.value}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-normal">{opt.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supervisor Justification Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Supervisor Notes & Justification
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add operational rationale, supervisor remarks, or follow-up instructions..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200/90 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};
