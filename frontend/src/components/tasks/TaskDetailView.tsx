import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  AlertOctagon,
  Radio,
  FileCheck,
  User,
  MapPin,
  History,
  Camera,
} from 'lucide-react';
import { Task, TaskAuditEvent } from '@aquasentinel/shared';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';
import { Button } from '../common/Button.js';
import { TaskLifecycleControls } from './TaskLifecycleControls.js';
import { FhirStatusBadge } from '../fhir/FhirStatusBadge.js';
import { FhirResourceViewer } from '../fhir/FhirResourceViewer.js';
import { ProvenanceModal } from '../provenance/ProvenanceModal.js';
import { FieldVerificationModal } from './FieldVerificationModal.js';
import { apiClient } from '../../api/client.js';

interface TaskDetailViewProps {
  task: Task;
  onTaskUpdated: (updated: Task) => void;
  onNavigateToIncident?: (incidentId: string) => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task,
  onTaskUpdated,
  onNavigateToIncident,
}) => {
  const [auditTrail, setAuditTrail] = useState<TaskAuditEvent[]>([]);
  const [fhirResource, setFhirResource] = useState<any | null>(null);
  const [isFhirModalOpen, setIsFhirModalOpen] = useState(false);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      setIsLoadingAudit(true);
      try {
        const [audit, fhir] = await Promise.all([
          apiClient.getTaskAuditTrail(task.id).catch(() => []),
          apiClient.getTaskFhir(task.id).catch(() => null),
        ]);
        if (isMounted) {
          setAuditTrail(audit);
          setFhirResource(fhir);
        }
      } finally {
        if (isMounted) setIsLoadingAudit(false);
      }
    };

    loadDetails();
    return () => {
      isMounted = false;
    };
  }, [task.id, task.status]);

  const getStatusVariant = (status: Task['status']) => {
    switch (status) {
      case 'VERIFIED':
        return 'purple';
      case 'COMPLETED':
        return 'emerald';
      case 'IN_PROGRESS':
        return 'cyan';
      case 'ACCEPTED':
        return 'blue';
      case 'REQUESTED':
        return 'amber';
      case 'CANCELLED':
        return 'rose';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <CheckSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500 font-bold">{task.id}</span>
                <Badge variant={getStatusVariant(task.status) as any} size="sm">
                  {task.status}
                </Badge>
                <Badge variant="amber" size="sm">
                  {task.priority} Priority
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{task.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FhirStatusBadge
              status={task.fhirTaskId ? 'SYNCHRONIZED' : 'PENDING'}
              fhirId={task.fhirTaskId}
              onViewResource={() => setIsFhirModalOpen(true)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsProvenanceModalOpen(true)}
            >
              <FileCheck size={13} className="mr-1 inline text-slate-500" />
              Provenance
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsVerificationModalOpen(true)}
            >
              <Camera size={13} className="mr-1 inline text-white" />
              Field Verification
            </Button>
          </div>
        </div>

        {/* Task Lifecycle Progression Bar */}
        <div className="pt-3 border-t border-slate-100">
          <TaskLifecycleControls task={task} onTaskUpdated={onTaskUpdated} />
        </div>
      </div>

      {/* 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Details, Instructions, and Questions */}
        <div className="lg:col-span-2 space-y-5">
          {/* WHAT: Field Instructions Card */}
          <Card className="p-5 space-y-3 bg-white border-slate-200/80 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
              <CheckSquare size={14} className="text-blue-600" />
              <span>WHAT: Operational Field Instructions</span>
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed font-sans bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
              {task.instructions}
            </p>

            {task.requiredEvidence && task.requiredEvidence.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">
                  Required Deliverables & Verification
                </span>
                <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                  {task.requiredEvidence.map((ev, idx) => (
                    <li key={idx} className="font-mono">{ev}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* WHY: Linked Anomaly & Incident */}
          <Card className="p-5 space-y-3 bg-white border-slate-200/80 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-2">
              <AlertOctagon size={14} className="text-rose-600" />
              <span>WHY: Linked Environmental Incident</span>
            </h4>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-900">
                  Incident Reference: <code className="font-mono text-blue-600 font-bold">{task.incidentId}</code>
                </span>
                <p className="text-xs text-slate-500">
                  Triggered from algorithmic recommendation: <code className="font-mono text-slate-700 font-medium">{task.recommendationId || 'Catalogue Match'}</code>
                </p>
              </div>

              {onNavigateToIncident && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigateToIncident(task.incidentId)}
                >
                  View Incident →
                </Button>
              )}
            </div>
          </Card>

          {/* Chronological Task Audit Trail */}
          <Card className="overflow-hidden bg-white border-slate-200/80 shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <History size={14} className="text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Immutable Task Audit Trail ({auditTrail.length})
                </h4>
              </div>
            </div>

            <div className="divide-y divide-slate-100 p-1">
              {isLoadingAudit ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading audit log...</div>
              ) : auditTrail.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Initial dispatch recorded. No subsequent transitions yet.
                </div>
              ) : (
                auditTrail.map((evt) => (
                  <div key={evt.id} className="p-3.5 hover:bg-slate-50/60 transition text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{evt.eventType.replace(/_/g, ' ')}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Actor: <strong className="text-slate-700">{evt.actor}</strong></span>
                      {evt.previousStatus && evt.newStatus && (
                        <span>
                          Transition: <code className="font-mono text-slate-700">{evt.previousStatus} → {evt.newStatus}</code>
                        </span>
                      )}
                    </div>
                    {evt.reason && (
                      <p className="text-slate-500 text-[11px] italic mt-1">"{evt.reason}"</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Metadata, Personnel, and Coordinates */}
        <div className="space-y-5">
          <Card className="p-5 space-y-4 text-xs bg-white border-slate-200/80 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
              Deployment Metadata
            </h4>

            <div className="space-y-3">
              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-medium">Assigned Personnel</span>
                <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <User size={14} className="text-blue-600" />
                  {task.assignedTo}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-medium">Assigned Role</span>
                <span className="font-semibold text-slate-800">{task.assignedRole || 'Field Inspector'}</span>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] uppercase font-medium">Coordinates</span>
                <span className="font-mono text-blue-600 font-bold flex items-center gap-1.5 mt-0.5">
                  <MapPin size={13} />
                  [{task.location.coordinates[0].toFixed(4)}, {task.location.coordinates[1].toFixed(4)}]
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block text-[11px] uppercase font-medium">Created At</span>
                <span className="font-mono text-slate-700">{new Date(task.createdAt).toLocaleString()}</span>
              </div>

              {task.completedAt && (
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase font-medium">Completed At</span>
                  <span className="font-mono text-emerald-600 font-semibold">{new Date(task.completedAt).toLocaleString()}</span>
                </div>
              )}

              {task.verifiedAt && (
                <div>
                  <span className="text-slate-500 block text-[11px] uppercase font-medium">Verified At</span>
                  <span className="font-mono text-purple-600 font-semibold">{new Date(task.verifiedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </Card>

          {/* FHIR Mirror Quick View Card */}
          <Card className="p-4 space-y-2.5 text-xs bg-purple-50/50 border-purple-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-800 flex items-center gap-1.5">
                <Radio size={14} />
                HL7 FHIR Interoperability
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFhirModalOpen(true)}
              >
                Inspect
              </Button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Task synchronized as an HL7 FHIR R4 Task resource with identifier <code className="font-mono text-purple-700 font-semibold">{task.fhirTaskId || 'Synchronized'}</code>.
            </p>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {isFhirModalOpen && (
        <FhirResourceViewer
          isOpen={isFhirModalOpen}
          onClose={() => setIsFhirModalOpen(false)}
          resource={fhirResource || { resourceType: 'Task', id: task.fhirTaskId || task.id, status: task.status.toLowerCase() }}
          title={`HL7 FHIR Task: ${task.id}`}
        />
      )}

      {isProvenanceModalOpen && (
        <ProvenanceModal
          isOpen={isProvenanceModalOpen}
          onClose={() => setIsProvenanceModalOpen(false)}
          provenance={task.provenance}
          lineage={{
            source: 'Response Engine',
            incidentId: task.incidentId,
            recommendationId: task.recommendationId,
            taskId: task.id,
            fhirTaskId: task.fhirTaskId,
          }}
        />
      )}

      {isVerificationModalOpen && (
        <FieldVerificationModal
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          task={task}
          onVerificationSubmitted={() => onTaskUpdated(task)}
        />
      )}
    </div>
  );
};
