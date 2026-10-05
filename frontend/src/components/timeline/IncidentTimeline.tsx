import React from 'react';
import {
  Activity,
  Satellite,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  CheckSquare,
  CheckCircle2,
  FileCheck,
  Radio,
  Clock,
  User,
} from 'lucide-react';
import { Badge } from '../common/Badge.js';
import { Card } from '../common/Card.js';

export interface TimelineItem {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  actor: string;
  category: 'OBSERVATION' | 'EVIDENCE' | 'INCIDENT' | 'RECOMMENDATION' | 'TASK' | 'VERIFICATION' | 'FHIR';
  status?: string;
  metadata?: Record<string, unknown>;
}

interface IncidentTimelineProps {
  timeline: TimelineItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  timeline,
  isLoading = false,
}) => {
  const getCategoryIcon = (category: TimelineItem['category']) => {
    switch (category) {
      case 'OBSERVATION':
        return <Satellite size={14} className="text-cyan-600" />;
      case 'EVIDENCE':
        return <ShieldAlert size={14} className="text-indigo-600" />;
      case 'INCIDENT':
        return <AlertTriangle size={14} className="text-rose-600" />;
      case 'RECOMMENDATION':
        return <Sparkles size={14} className="text-amber-600" />;
      case 'TASK':
        return <CheckSquare size={14} className="text-blue-600" />;
      case 'VERIFICATION':
        return <CheckCircle2 size={14} className="text-emerald-600" />;
      case 'FHIR':
        return <Radio size={14} className="text-purple-600" />;
      default:
        return <Activity size={14} className="text-slate-500" />;
    }
  };

  const getCategoryBadgeVariant = (category: TimelineItem['category']) => {
    switch (category) {
      case 'OBSERVATION':
        return 'cyan';
      case 'EVIDENCE':
        return 'indigo';
      case 'INCIDENT':
        return 'rose';
      case 'RECOMMENDATION':
        return 'amber';
      case 'TASK':
        return 'blue';
      case 'VERIFICATION':
        return 'emerald';
      case 'FHIR':
        return 'purple';
      default:
        return 'slate';
    }
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Loading chronological event audit...</span>
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <Card className="text-center py-10 bg-white border-slate-200/80">
        <Clock size={24} className="text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-900">No Timeline Events Recorded</p>
        <p className="text-xs text-slate-500 mt-1">Events will appear chronologically as observations and tasks evolve.</p>
      </Card>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {timeline.map((item) => (
        <div key={item.id} className="relative group">
          {/* Node Dot */}
          <div className="absolute -left-[23px] top-1.5 h-5 w-5 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center group-hover:border-blue-600 transition shadow-xs">
            {getCategoryIcon(item.category)}
          </div>

          <div className="bg-white hover:bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 transition shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={getCategoryBadgeVariant(item.category) as any} size="sm">
                  {item.category}
                </Badge>
                <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                {item.status && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {item.status}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                <Clock size={12} />
                <span>
                  {formatDate(item.timestamp)} {formatTime(item.timestamp)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{item.description}</p>

            <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <User size={12} className="text-slate-400" />
                <span>Actor: <strong className="text-slate-700 font-medium">{item.actor}</strong></span>
              </div>
              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <FileCheck size={11} className="text-slate-400" />
                  <span className="text-slate-600">Metadata: {JSON.stringify(item.metadata)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
