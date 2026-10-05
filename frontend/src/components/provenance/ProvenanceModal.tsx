import React from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { ArrowRight, Database, ShieldCheck, FileCheck, Layers, GitFork, Radio } from 'lucide-react';
import { ProvenanceRecord } from '@aquasentinel/shared';

interface ProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  provenance?: ProvenanceRecord | null;
  lineage?: {
    source?: string;
    observationId?: string;
    assessmentId?: string;
    incidentId?: string;
    recommendationId?: string;
    taskId?: string;
    fhirTaskId?: string;
  };
}

export const ProvenanceModal: React.FC<ProvenanceModalProps> = ({
  isOpen,
  onClose,
  provenance,
  lineage,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Operational Provenance & Audit Lineage" maxWidth="max-w-3xl">
      <div className="space-y-5">
        <p className="text-xs text-slate-500 leading-relaxed">
          Complete algorithmic lineage tracing environmental detection through evidence assessment, supervisory human review, and HL7 FHIR synchronization.
        </p>

        {/* Visual Lineage Pipeline */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Lineage Pipeline Flow
          </span>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-2xs font-medium">
              <Database size={13} className="text-blue-600" />
              <span>{lineage?.source || provenance?.source || 'Source Ingestion'}</span>
            </div>
            <ArrowRight size={14} className="text-slate-400" />

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-2xs font-medium">
              <Layers size={13} className="text-indigo-600" />
              <span>Evidence Fusion</span>
            </div>
            <ArrowRight size={14} className="text-slate-400" />

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-2xs font-medium">
              <GitFork size={13} className="text-amber-600" />
              <span>Response Engine</span>
            </div>
            <ArrowRight size={14} className="text-slate-400" />

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-800 border border-slate-200 shadow-2xs font-medium">
              <FileCheck size={13} className="text-emerald-600" />
              <span>Task Action</span>
            </div>
            <ArrowRight size={14} className="text-slate-400" />

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs font-medium">
              <Radio size={13} className="text-purple-600" />
              <span>FHIR R4</span>
            </div>
          </div>
        </div>

        {/* Provenance Record Metadata */}
        {provenance ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 text-xs shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-slate-900">Provenance Identifier</span>
              <span className="font-mono text-blue-700 font-bold">{provenance.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Source Entity</span>
                <span className="text-slate-900 font-mono font-semibold">{provenance.entityType}: {provenance.entityId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Acquisition / Source</span>
                <span className="text-slate-900 font-semibold">{provenance.source}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Processing Method / Engine</span>
                <span className="text-slate-900 font-mono font-medium">{provenance.processingMethod || 'AQUASENTINEL_DETERMINISTIC_FUSION'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold uppercase">Quality Certification</span>
                <div className="mt-1">
                  <Badge variant={provenance.qualityStatus === 'VALIDATED' ? 'emerald' : 'amber'} size="sm">
                    <ShieldCheck size={11} className="mr-1 inline" />
                    {provenance.qualityStatus}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1">Timestamp Chain</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[11px] text-slate-700">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Acquired: {provenance.acquisitionTimestamp || 'N/A'}</div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Ingested: {provenance.ingestionTimestamp || 'N/A'}</div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Processed: {provenance.processingTimestamp || 'N/A'}</div>
              </div>
            </div>

            {provenance.metadata && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-500 block text-[11px] font-semibold uppercase mb-1.5">Algorithmic Telemetry & Metadata</span>
                <pre className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[10px] font-mono text-slate-800 overflow-x-auto max-h-40">
                  {JSON.stringify(provenance.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 text-xs space-y-3 shadow-xs">
            <span className="font-bold text-slate-900 block">Associated Object References</span>
            <div className="grid grid-cols-1 gap-2 font-mono text-[11px] text-slate-700">
              {lineage?.observationId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Observation ID: {lineage.observationId}</div>}
              {lineage?.assessmentId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Assessment ID: {lineage.assessmentId}</div>}
              {lineage?.incidentId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Incident ID: {lineage.incidentId}</div>}
              {lineage?.recommendationId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Recommendation ID: {lineage.recommendationId}</div>}
              {lineage?.taskId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">Task ID: {lineage.taskId}</div>}
              {lineage?.fhirTaskId && <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60">FHIR Task Resource: Task/{lineage.fhirTaskId}</div>}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Lineage Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
};
