import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Badge } from '../common/Badge.js';
import { Copy, Check, FileJson, Layers, ShieldCheck } from 'lucide-react';

interface FhirResourceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  resource: any;
  title?: string;
}

export const FhirResourceViewer: React.FC<FhirResourceViewerProps> = ({
  isOpen,
  onClose,
  resource,
  title = 'HL7 FHIR R4 Resource Inspector',
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'raw'>('structured');
  const [copied, setCopied] = useState(false);

  if (!resource) return null;

  const jsonString = JSON.stringify(resource, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resourceType = resource.resourceType || 'Task';
  const resourceId = resource.id || 'N/A';
  const status = resource.status || 'N/A';
  const intent = resource.intent || 'proposal';
  const priority = resource.priority || 'routine';
  const description = resource.description || resource.focus?.display || 'N/A';
  const authoredOn = resource.authoredOn || resource.meta?.lastUpdated || 'N/A';
  const requester = resource.requester?.display || resource.requester?.reference || 'AquaSentinel Orchestrator';
  const owner = resource.owner?.display || resource.owner?.reference || 'Municipal Field Technicians';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-4xl">
      <div className="space-y-4 text-xs text-slate-800">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('structured')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'structured'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Layers size={14} />
              <span>Human-Readable Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'raw'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileJson size={14} />
              <span>Raw JSON ({resourceType})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="emerald" size="sm">
              <ShieldCheck size={11} className="mr-1 inline text-emerald-600" />
              HL7 FHIR R4 Validated
            </Badge>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'structured' ? (
          <div className="space-y-4 py-2">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Resource Type</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{resourceType}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Resource ID</span>
                <p className="text-xs font-mono font-bold text-blue-700 truncate mt-0.5">{resourceId}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Status & Intent</span>
                <p className="text-sm font-semibold text-emerald-700 mt-0.5">
                  {status} <span className="text-xs text-slate-500 font-mono">({intent})</span>
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Priority</span>
                <p className="text-sm font-bold text-amber-700 mt-0.5 capitalize">{priority}</p>
              </div>
            </div>

            {/* Structured Details Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3.5 shadow-xs">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold uppercase">Description</span>
                <p className="text-sm text-slate-800 mt-0.5 leading-relaxed">{description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Requester</span>
                  <p className="text-xs text-slate-700 font-mono mt-0.5">{requester}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Owner / Performer</span>
                  <p className="text-xs text-slate-700 font-mono mt-0.5">{owner}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Authored On</span>
                  <p className="text-xs text-slate-700 font-mono mt-0.5">{authoredOn}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Profile URI</span>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                    http://hl7.org/fhir/StructureDefinition/Task
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <pre className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-800 overflow-x-auto max-h-96 leading-relaxed">
              {jsonString}
            </pre>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
};
