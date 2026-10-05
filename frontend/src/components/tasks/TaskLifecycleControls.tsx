import React, { useState } from 'react';
import {
  CheckCircle2,
  Play,
  CheckCheck,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Task, TaskStatus } from '@aquasentinel/shared';
import { Button } from '../common/Button.js';
import { apiClient } from '../../api/client.js';

interface TaskLifecycleControlsProps {
  task: Task;
  onTaskUpdated: (updated: Task) => void;
  disabled?: boolean;
}

export const TaskLifecycleControls: React.FC<TaskLifecycleControlsProps> = ({
  task,
  onTaskUpdated,
  disabled = false,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentStatus = task.status;

  // Determine allowed transitions strictly per PRD Section 22
  const canAccept = currentStatus === 'REQUESTED';
  const canStart = currentStatus === 'ACCEPTED';
  const canComplete = currentStatus === 'IN_PROGRESS';
  const canVerify = currentStatus === 'COMPLETED';
  const canCancel = currentStatus !== 'COMPLETED' && currentStatus !== 'VERIFIED' && currentStatus !== 'CANCELLED';

  const executeTransition = async (action: 'accept' | 'start' | 'complete' | 'verify' | 'cancel', notes?: string) => {
    setIsUpdating(true);
    setErrorMessage(null);

    try {
      let updated: Task;
      if (action === 'accept') {
        updated = await apiClient.transitionTask(task.id, 'accept', {
          actor: task.assignedTo || 'Field Technician',
          notes: notes || 'Field technician accepted operational assignment.',
        });
      } else if (action === 'start') {
        updated = await apiClient.transitionTask(task.id, 'start', {
          actor: task.assignedTo || 'Field Technician',
          notes: notes || 'Field operation started at target stream reach coordinates.',
        });
      } else if (action === 'complete') {
        updated = await apiClient.transitionTask(task.id, 'complete', {
          actor: task.assignedTo || 'Field Technician',
          notes: notes || 'Operational task protocol completed successfully and logged.',
        });
      } else if (action === 'verify') {
        updated = await apiClient.transitionTask(task.id, 'verify', {
          actor: 'Municipal Supervisor',
          notes: notes || 'Supervisory verification completed and approved.',
        });
      } else {
        updated = await apiClient.transitionTask(task.id, 'cancel', {
          actor: 'Operations Center',
          notes: notes || 'Task cancelled by municipal operational authority.',
        });
      }

      onTaskUpdated(updated);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task lifecycle.');
    } finally {
      setIsUpdating(false);
      setNotesModalOpen(false);
      setPendingAction(null);
      setNotesInput('');
    }
  };

  const handleActionClick = (action: 'accept' | 'start' | 'complete' | 'verify' | 'cancel') => {
    if (action === 'complete' || action === 'verify' || action === 'cancel') {
      setPendingAction(action);
      setNotesModalOpen(true);
    } else {
      executeTransition(action);
    }
  };

  return (
    <div className="space-y-3">
      {/* Lifecycle Flow Visualizer */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-[11px] font-mono">
        {(['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'] as TaskStatus[]).map((st, idx, arr) => {
          const isPassed =
            st === currentStatus ||
            (currentStatus === 'ACCEPTED' && st === 'REQUESTED') ||
            (currentStatus === 'IN_PROGRESS' && ['REQUESTED', 'ACCEPTED'].includes(st)) ||
            (currentStatus === 'COMPLETED' && ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'].includes(st)) ||
            (currentStatus === 'VERIFIED' && ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(st));
          const isCurrent = currentStatus === st;

          return (
            <React.Fragment key={st}>
              <span
                className={`px-2.5 py-1 rounded-lg transition font-medium text-xs ${
                  isCurrent
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-semibold'
                    : isPassed
                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                    : 'bg-transparent text-slate-400 border border-transparent'
                }`}
              >
                {st}
              </span>
              {idx < arr.length - 1 && <ArrowRight size={12} className="text-slate-400 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canAccept && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleActionClick('accept')}
            disabled={disabled || isUpdating}
          >
            <CheckCircle2 size={13} className="mr-1 inline text-white" />
            Accept Task (Field Ack)
          </Button>
        )}

        {canStart && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleActionClick('start')}
            disabled={disabled || isUpdating}
          >
            <Play size={13} className="mr-1 inline text-white" />
            Start Field Work
          </Button>
        )}

        {canComplete && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleActionClick('complete')}
            disabled={disabled || isUpdating}
          >
            <CheckCheck size={13} className="mr-1 inline text-white" />
            Mark Work Completed
          </Button>
        )}

        {canVerify && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleActionClick('verify')}
            disabled={disabled || isUpdating}
          >
            <ShieldCheck size={13} className="mr-1 inline text-white" />
            Supervisory Verification
          </Button>
        )}

        {currentStatus === 'VERIFIED' && (
          <span className="inline-flex items-center gap-1 text-xs text-purple-700 font-semibold px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200">
            <ShieldCheck size={13} />
            Verified & Archived
          </span>
        )}

        {canCancel && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('cancel')}
            disabled={disabled || isUpdating}
          >
            <XCircle size={13} className="mr-1 inline text-rose-600" />
            Cancel Task
          </Button>
        )}
      </div>

      {errorMessage && (
        <div className="text-xs text-rose-600 flex items-center gap-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200">
          <AlertTriangle size={13} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Confirmation / Notes Modal for Completion, Verification, and Cancellation */}
      {notesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/90 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              {pendingAction === 'complete'
                ? 'Record Task Completion'
                : pendingAction === 'verify'
                ? 'Supervisory Verification Sign-Off'
                : 'Confirm Task Cancellation'}
            </h4>

            <p className="text-xs text-slate-500">
              {pendingAction === 'complete'
                ? 'Document operational findings and outcomes from the field.'
                : pendingAction === 'verify'
                ? 'Confirm that all field deliverables and measurements have been validated.'
                : 'Document why this task is being aborted.'}
            </p>

            <div>
              <label className="block text-slate-700 font-semibold text-xs mb-1">
                Execution Notes & Observations
              </label>
              <textarea
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Field observations, sample IDs, sensor measurements..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setNotesModalOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                variant={pendingAction === 'cancel' ? 'danger' : 'primary'}
                size="sm"
                onClick={() => executeTransition(pendingAction as any, notesInput)}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
