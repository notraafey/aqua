import React, { useState } from 'react';
import {
  OutboxEvent,
  InteroperabilityAuditEntry,
  InteroperabilityAcknowledgement,
} from '@aquasentinel/shared';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  X,
  Copy,
  Check,
  AlertTriangle,
  Send,
  RotateCcw,
  CheckCircle2,
  Clock,
  Radio,
  FileCode,
  ShieldCheck,
  Activity,
} from 'lucide-react';

interface EventDetailModalProps {
  event: OutboxEvent;
  auditTrail: InteroperabilityAuditEntry[];
  acknowledgements: InteroperabilityAcknowledgement[];
  isOpen: boolean;
  onClose: () => void;
  onRetry: (eventId: string) => Promise<void>;
  onReplay: (eventId: string) => Promise<void>;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  auditTrail,
  acknowledgements,
  isOpen,
  onClose,
  onRetry,
  onReplay,
}) => {
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'resource' | 'audit' | 'acks'>('resource');

  if (!isOpen) return null;

  const copyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: OutboxEvent['status']) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="emerald">Delivered</Badge>;
      case 'PENDING':
        return <Badge variant="cyan">Pending</Badge>;
      case 'DELIVERING':
        return <Badge variant="blue">Delivering</Badge>;
      case 'RETRYING':
        return <Badge variant="amber">Retrying</Badge>;
      case 'DEAD_LETTER':
        return <Badge variant="rose">Dead-Letter</Badge>;
      case 'FAILED':
        return <Badge variant="rose">Failed</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const handleRetry = async () => {
    setIsProcessing(true);
    try {
      await onRetry(event.eventId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReplay = async () => {
    setIsProcessing(true);
    try {
      await onReplay(event.eventId);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-mono">{event.eventType}</h3>
                {getStatusBadge(event.status)}
              </div>
              <p className="text-xs text-slate-500 font-mono">Event ID: {event.eventId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-800">
          {/* Scientific Proxy Disclosure Invariant */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-amber-950">Scientific Proxy Disclosure: </span>
              Optical remote-sensing signals (NDCI) indicate biogenic anomaly and require in-situ corroboration.
              Not a clinical or pathogen diagnostic. Downstream recipients must maintain verification context.
            </div>
          </div>

          {/* Quick Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Subject</span>
              <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">{event.subject}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Resource Type</span>
              <span className="text-xs font-bold text-blue-700 block mt-0.5">{event.resourceType}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Destination</span>
              <span className="text-xs font-semibold text-slate-700 truncate block mt-0.5" title={event.destination}>
                {event.destination.replace(/https?:\/\//, '')}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 uppercase font-semibold block">Retries / Replay</span>
              <span className="text-xs font-semibold text-slate-700 block mt-0.5">
                {event.retryCount}/{event.maxRetries} {event.replayCount ? `(Replayed: ${event.replayCount})` : ''}
              </span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 gap-6">
            <button
              onClick={() => setActiveTab('resource')}
              className={`pb-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'resource'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCode className="w-4 h-4" />
              FHIR R4 Payload
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'audit'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-4 h-4" />
              Audit Trail ({auditTrail.length})
            </button>
            <button
              onClick={() => setActiveTab('acks')}
              className={`pb-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'acks'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Acknowledgements ({acknowledgements.length})
            </button>
          </div>

          {/* Tab Content: FHIR Resource */}
          {activeTab === 'resource' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="emerald" size="sm">
                    FHIR R4 Compliant
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    Envelope Schema v{event.eventVersion}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyJson(event.payload)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </Button>
              </div>

              <div className="relative rounded-xl bg-slate-50 p-4 border border-slate-200 font-mono text-xs text-slate-800 max-h-80 overflow-y-auto">
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Tab Content: Audit Trail */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditTrail.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No audit records recorded yet.</div>
              ) : (
                auditTrail.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3 shadow-2xs"
                  >
                    <div className="p-1.5 rounded-full bg-slate-100 shrink-0 mt-0.5">
                      {entry.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : entry.status === 'FAILURE' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 font-mono">{entry.stage}</span>
                        <span className="text-[11px] text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{entry.message}</p>
                      {entry.details && Object.keys(entry.details).length > 0 && (
                        <div className="mt-1.5 p-2 rounded-lg bg-slate-50 text-[11px] font-mono text-slate-700 overflow-x-auto border border-slate-200/60">
                          {JSON.stringify(entry.details)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab Content: Acknowledgements */}
          {activeTab === 'acks' && (
            <div className="space-y-3">
              {acknowledgements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No downstream acknowledgements received for this event yet.
                </div>
              ) : (
                acknowledgements.map((ack) => (
                  <div
                    key={ack.acknowledgementId}
                    className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900 font-mono">{ack.consumerId}</span>
                        <Badge variant={ack.status === 'ACCEPTED' ? 'emerald' : 'cyan'}>{ack.status}</Badge>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(ack.receivedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-700 font-mono">
                      Ack ID: <span className="text-slate-500">{ack.acknowledgementId}</span>
                    </div>
                    {ack.details && (
                      <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                        {JSON.stringify(ack.details)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <div className="text-xs text-slate-500">
            {event.lastError && (
              <span className="text-rose-600 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Last error: {event.lastError}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(event.status === 'RETRYING' || event.status === 'FAILED') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isProcessing}
                className="flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                Retry Delivery
              </Button>
            )}
            {event.status === 'DEAD_LETTER' && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleReplay}
                disabled={isProcessing}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Replay Event
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
