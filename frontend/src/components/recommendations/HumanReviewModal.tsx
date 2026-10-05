import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Radio,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import { Recommendation, Task } from '@aquasentinel/shared';
import { apiClient } from '../../api/client.js';

interface HumanReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
  onSuccess: (task?: Task) => void;
}

export const HumanReviewModal: React.FC<HumanReviewModalProps> = ({
  isOpen,
  onClose,
  recommendation,
  onSuccess,
}) => {
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'MORE_EVIDENCE'>('APPROVE');
  const [assignedTo, setAssignedTo] = useState('Officer K. Dimitriou (Inspectorate)');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH');
  const [executionNotes, setExecutionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [missingDataItems] = useState<string[]>([
    'In-situ Optical Clarity & Dissolved Oxygen',
    'Geotagged Photographic Ground Verification',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    task: Task;
    fhirTaskId?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !recommendation) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (reviewAction === 'APPROVE') {
        const res = await apiClient.approveRecommendation(recommendation.id, {
          actor: 'Municipal Environmental Officer',
          assignedTo,
          notes: executionNotes || `Execute ${recommendation.title} (Priority: ${priority}) per municipal environmental response protocol.`,
        });

        if (res.task) {
          setApprovalResult({
            task: res.task,
            fhirTaskId: res.task.fhirTaskId,
          });
          onSuccess(res.task);
        } else {
          onSuccess();
          onClose();
        }
      } else if (reviewAction === 'REJECT') {
        if (!rejectionReason.trim()) {
          setErrorMessage('Rejection requires a documented justification.');
          setIsSubmitting(false);
          return;
        }

        await apiClient.rejectRecommendation(recommendation.id, {
          actor: 'Municipal Environmental Officer',
          reason: rejectionReason,
        });

        onSuccess();
        onClose();
      } else {
        await apiClient.requestMoreEvidence(recommendation.id, {
          actor: 'Municipal Environmental Officer',
          notes: executionNotes || 'Dispatched for targeted field corroboration.',
          missingData: missingDataItems,
          assignedTo,
        });

        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed. Please verify network connectivity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setApprovalResult(null);
        onClose();
      }}
      title={approvalResult ? 'Action Approved & Task Dispatched' : 'Human Supervisory Review & Approval'}
      maxWidth="max-w-2xl"
    >
      {approvalResult ? (
        /* Post-Approval Confirmation Screen */
        <div className="space-y-4 py-2">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 size={24} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">
                Recommendation Approved Successfully
              </h4>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Operational Task <strong className="font-mono font-bold text-slate-900">{approvalResult.task.id.slice(0, 8)}...</strong> has been generated and queued for field execution.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Task Identifier</span>
              <span className="font-mono text-blue-700 font-bold">{approvalResult.task.id}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Assigned Field Role</span>
              <span className="font-semibold text-slate-800">{approvalResult.task.assignedRole || 'Environmental Inspector'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">Assigned Personnel</span>
              <span className="font-semibold text-slate-800">{approvalResult.task.assignedTo}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase">HL7 FHIR Mirror</span>
              <span className="font-mono text-purple-700 font-bold flex items-center gap-1 mt-0.5">
                <Radio size={12} />
                {approvalResult.fhirTaskId ? `Task/${approvalResult.fhirTaskId.slice(0, 8)}...` : 'Synchronized'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <Button
              variant="primary"
              onClick={() => {
                setApprovalResult(null);
                onClose();
              }}
            >
              Continue to Operational Tasks
            </Button>
          </div>
        </div>
      ) : (
        /* Review Form */
        <div className="space-y-4 text-xs text-slate-800">
          {/* Recommendation Summary */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="cyan" size="sm">
                  Rank #{recommendation.rank}
                </Badge>
                <h4 className="text-sm font-bold text-slate-900">{recommendation.title}</h4>
              </div>
              <span className="font-mono font-bold text-blue-700 text-sm">
                {recommendation.suitabilityScore} / 100 Suitability
              </span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">{recommendation.description}</p>
          </div>

          {/* Action Mode Selector */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setReviewAction('APPROVE')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition ${
                reviewAction === 'APPROVE'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 size={18} className={reviewAction === 'APPROVE' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Approve & Dispatch</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewAction('MORE_EVIDENCE')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition ${
                reviewAction === 'MORE_EVIDENCE'
                  ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <HelpCircle size={18} className={reviewAction === 'MORE_EVIDENCE' ? 'text-amber-600' : 'text-slate-400'} />
              <span>Request Evidence</span>
            </button>

            <button
              type="button"
              onClick={() => setReviewAction('REJECT')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 font-semibold text-xs transition ${
                reviewAction === 'REJECT'
                  ? 'bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <XCircle size={18} className={reviewAction === 'REJECT' ? 'text-rose-600' : 'text-slate-400'} />
              <span>Reject Measure</span>
            </button>
          </div>

          {/* Form Fields Depending on Action */}
          {reviewAction === 'APPROVE' && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1 text-xs">Assigned Personnel / Unit</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 font-mono text-xs transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1 text-xs">Operational Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 font-mono text-xs transition-all"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">Execution Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={executionNotes}
                  onChange={(e) => setExecutionNotes(e.target.value)}
                  placeholder="Specific field instructions or equipment requirements..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 text-xs transition-all"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-blue-900 flex items-center gap-2">
                <FileCheck size={14} className="text-blue-600 shrink-0" />
                <span>Supervisory approval triggers automatic HL7 FHIR R4 Task resource synchronization.</span>
              </div>
            </div>
          )}

          {reviewAction === 'REJECT' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">
                  Documented Justification for Rejection <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this recommended intervention is inappropriate or inapplicable..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:bg-white focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 text-xs transition-all"
                />
              </div>
            </div>
          )}

          {reviewAction === 'MORE_EVIDENCE' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">Missing Evidence Items Needed</label>
                <div className="space-y-1.5">
                  {missingDataItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-amber-900">
                      <ShieldAlert size={14} className="text-amber-600" />
                      <span className="font-mono text-xs font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1 text-xs">Dispatch Inspector for Corroboration</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 font-mono text-xs transition-all"
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === 'REJECT' ? 'danger' : 'primary'}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Processing...'
                : reviewAction === 'APPROVE'
                ? 'Confirm Approval & Dispatch'
                : reviewAction === 'REJECT'
                ? 'Confirm Rejection'
                : 'Request Evidence'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
