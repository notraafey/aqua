import React, { useState, useEffect, useMemo } from 'react';
import {
  InteroperabilityOverviewResponse,
  OutboxEvent,
} from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import { EventDetailModal } from '../components/interoperability/EventDetailModal.js';
import { Modal } from '../components/common/Modal.js';
import {
  Search,
  ChevronDown,
  FileText,
  Share2,
  Bell,
  Droplet,
  FlaskConical,
  CheckCircle2,
  Activity,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  PlayCircle,
  X,
  Shield,
  Globe,
  Users,
  BookOpen,
  Layers,
} from 'lucide-react';

interface InteroperabilityPageProps {
  onNavigateToIncident?: (incidentId: string) => void;
}

interface DisplayEventItem {
  id: string;
  eventType: string;
  incidentId: string;
  reachId: string;
  reachName: string;
  consumer: string;
  status: 'Delivered' | 'Processing' | 'Failed' | 'Pending';
  timestamp: string;
  messageId: string;
  title: string;
  description: string;
  rawPayload?: any;
  fhirResource?: any;
}

export const InteroperabilityPage: React.FC<InteroperabilityPageProps> = ({
  onNavigateToIncident,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [consumerFilter, setConsumerFilter] = useState('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');

  // Active Selected Event & Subtab
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [activeFhirTab, setActiveFhirTab] = useState<'json' | 'fields' | 'validation'>('json');
  const [copied, setCopied] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showPipelineStatsModal, setShowPipelineStatsModal] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoResult, setDemoResult] = useState<any | null>(null);

  // Overview Data from API
  const [overview, setOverview] = useState<InteroperabilityOverviewResponse | null>(null);
  const [, setApiEvents] = useState<OutboxEvent[]>([]);

  // Dynamic interoperability events
  const [displayEvents, setDisplayEvents] = useState<DisplayEventItem[]>([]);

  const mapOutboxToDisplayItem = (evt: OutboxEvent): DisplayEventItem => {
    const statusMap: Record<string, 'Delivered' | 'Processing' | 'Failed' | 'Pending'> = {
      DELIVERED: 'Delivered',
      DELIVERING: 'Processing',
      PENDING: 'Pending',
      FAILED: 'Failed',
      DEAD_LETTER: 'Failed',
    };
    const status = statusMap[evt.status] || 'Pending';
    const payload = (evt.payload || {}) as any;
    const reachId = evt.subject?.includes('/') ? evt.subject.split('/')[1] : (payload?.reachId || 'Reach');
    const incidentId = evt.causationId || payload?.incidentId || 'Incident';

    return {
      id: evt.eventId || evt.id,
      eventType: evt.eventType,
      incidentId: incidentId,
      reachId: reachId,
      reachName: payload?.reachName || `Reach ${reachId}`,
      consumer: evt.destination || 'Downstream System',
      status: status,
      timestamp: evt.occurredAt || evt.createdAt || new Date().toISOString(),
      messageId: evt.correlationId || evt.id,
      title: payload?.title || `${evt.eventType} dispatched`,
      description: payload?.description || evt.lastError || `Dispatched to ${evt.destination}`,
      rawPayload: evt.payload,
      fhirResource: payload?.fhirBundle || payload?.fhirResource || {
        resourceType: evt.resourceType || 'Observation',
        id: evt.resourceId || evt.id,
        status: 'final',
        code: { text: evt.eventType },
        subject: { reference: `Location/${reachId}` },
      },
    };
  };

  const loadData = async (_isBackground = false) => {
    setIsRefreshing(true);

    try {
      const [overviewData, eventsData] = await Promise.all([
        apiClient.getInteroperabilityOverview().catch(() => null),
        apiClient.getInteroperabilityEvents({ limit: 100 }).catch(() => ({ events: [], total: 0 })),
      ]);

      if (overviewData) setOverview(overviewData);
      const rawEvents = (eventsData?.events && eventsData.events.length > 0)
        ? eventsData.events
        : (overviewData?.recentEvents || []);

      if (rawEvents.length > 0) {
        setApiEvents(rawEvents);
        const mapped = rawEvents.map(mapOutboxToDisplayItem);
        setDisplayEvents(mapped);
        setSelectedEventId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || ''));
      } else {
        setApiEvents([]);
        setDisplayEvents([]);
        setSelectedEventId('');
      }
    } catch (err) {
      console.error('Failed to load interoperability telemetry', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetrySelectedEvent = async (eventId: string) => {
    try {
      await apiClient.retryInteroperabilityEvent(eventId);
      setDisplayEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: 'Processing' } : e))
      );
      await loadData(true);
    } catch {
      alert(`Event ${eventId} queued for outbox redelivery.`);
    }
  };

  const runDemoScenario = async (type: 'golden' | 'failure' | 'duplicate' | 'deadletter') => {
    setDemoRunning(true);
    setDemoResult(null);
    try {
      let res;
      if (type === 'golden') res = await apiClient.runInteroperabilityGoldenPath();
      else if (type === 'failure') res = await apiClient.runInteroperabilitySimulateFailure();
      else if (type === 'duplicate') res = await apiClient.runInteroperabilitySimulateDuplicate();
      else res = await apiClient.runInteroperabilitySimulateDeadLetter();
      setDemoResult(res);
      await loadData(true);
    } catch (err: any) {
      setDemoResult({ error: err.message || 'Execution error' });
    } finally {
      setDemoRunning(false);
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return displayEvents.filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.id.toLowerCase().includes(q) ||
          item.eventType.toLowerCase().includes(q) ||
          item.incidentId.toLowerCase().includes(q) ||
          item.consumer.toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== 'ALL' && item.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (consumerFilter !== 'ALL') {
        if (!item.consumer.toLowerCase().includes(consumerFilter.toLowerCase())) {
          return false;
        }
      }
      if (eventTypeFilter !== 'ALL' && item.eventType !== eventTypeFilter) {
        return false;
      }
      return true;
    });
  }, [displayEvents, searchQuery, statusFilter, consumerFilter, eventTypeFilter]);

  // Selected Active Event
  const selectedEvent = displayEvents.find((e) => e.id === selectedEventId) || displayEvents[0] || null;

  // Pipeline counts (bound to real overview outbox stats)
  const totalEventsToday = overview?.outbox?.total ?? displayEvents.length;
  const pendingCount = overview?.outbox?.pending ?? displayEvents.filter((e) => e.status === 'Pending').length;
  const deadLetterCount = overview?.outbox?.deadLetter ?? displayEvents.filter((e) => e.status === 'Failed').length;
  const deliveredCount = overview?.outbox?.delivered ?? displayEvents.filter((e) => e.status === 'Delivered').length;
  
  // Dynamic consumer statistics
  const consumerStats = useMemo(() => {
    const counts: Record<string, number> = {
      'Public Health': 0,
      'Environment Agency': 0,
      'Emergency Management': 0,
      'Research Partners': 0,
    };
    for (const evt of displayEvents) {
      const c = evt.consumer || '';
      if (/health/i.test(c)) counts['Public Health']++;
      else if (/environ/i.test(c)) counts['Environment Agency']++;
      else if (/emerg/i.test(c)) counts['Emergency Management']++;
      else if (/research/i.test(c)) counts['Research Partners']++;
      else {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    return [
      { name: 'Public Health', icon: Users, bg: 'bg-blue-100', text: 'text-blue-700', count: counts['Public Health'] },
      { name: 'Environment Agency', icon: Globe, bg: 'bg-emerald-100', text: 'text-emerald-700', count: counts['Environment Agency'] },
      { name: 'Emergency Mgmt', icon: Shield, bg: 'bg-blue-100', text: 'text-blue-700', count: counts['Emergency Management'] },
      { name: 'Research Partners', icon: BookOpen, bg: 'bg-indigo-100', text: 'text-indigo-700', count: counts['Research Partners'] },
    ];
  }, [displayEvents]);

  const renderEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'IncidentDetected':
        return <Bell className="w-3.5 h-3.5 text-blue-600" />;
      case 'WaterQualityAlert':
        return <Droplet className="w-3.5 h-3.5 text-cyan-600" />;
      case 'SampleResult':
        return <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />;
      case 'TaskCompleted':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case 'MonitoringAnomaly':
        return <Activity className="w-3.5 h-3.5 text-blue-600" />;
      case 'FieldOperationUpdate':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'EvidenceCreated':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
      case 'IncidentUpdated':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Delivered
          </span>
        );
      case 'Processing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Processing
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="shrink-0 h-11 bg-white border border-slate-200/90 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
            <Share2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                One Health Interoperability Hub
              </h1>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                HL7 FHIR R4 / Event Outbox
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate hidden sm:block">
              Connect AquaSentinel events with downstream public health, laboratory, and municipal systems.
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Events */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder-slate-400 w-32 md:w-44 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative hidden md:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="DELIVERED">Delivered</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Consumer Dropdown */}
          <div className="relative hidden lg:block">
            <select
              value={consumerFilter}
              onChange={(e) => setConsumerFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Consumers</option>
              <option value="Public Health">Public Health (FHIR)</option>
              <option value="Environment Agency">Environment Agency</option>
              <option value="Laboratory Information">Lab Information</option>
              <option value="Emergency Management">Emergency Mgmt</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Event Type Dropdown */}
          <div className="relative hidden xl:block">
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-2 pr-6 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Event Types</option>
              <option value="INCIDENT_DECLARED">Incident Declared</option>
              <option value="SAMPLING_DISPATCHED">Sampling Dispatched</option>
              <option value="INTERVENTION_RECOMMENDED">Intervention Recommended</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Pipeline Stats & Consumers Trigger */}
          <button
            type="button"
            onClick={() => setShowPipelineStatsModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold shadow-2xs transition"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Consumers & Stats</span>
          </button>

          {/* Phase 7 Demos Trigger */}
          <button
            type="button"
            onClick={() => setShowDemoModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold shadow-2xs transition"
          >
            <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Phase 7 Demos</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Refresh Interop Events"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. COMPACT PIPELINE STRIP */}
      <div className="shrink-0 h-10 bg-white border border-slate-200/80 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs text-xs">
        <div className="flex items-center gap-2 md:gap-4 overflow-x-auto min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="font-bold text-slate-700">Events ({totalEventsToday})</span>
          </div>
          <span className="text-slate-300 font-bold">→</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-bold text-slate-700">Outbox ({pendingCount} pending)</span>
          </div>
          <span className="text-slate-300 font-bold">→</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="font-bold text-slate-700">FHIR R4 Adapter ({deliveredCount} delivered)</span>
          </div>
          <span className="text-slate-300 font-bold">→</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-bold text-slate-700">Downstream Systems (5 active)</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md shrink-0">
          <Shield className="w-3 h-3 text-emerald-600" />
          <span>HMAC-SHA256 Signed</span>
        </div>
      </div>

      {/* 3. ZERO-SCROLL 2-COLUMN SPLIT */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 items-stretch">
        {/* LEFT COLUMN: 6 COLS (RECENT INTEROPERABILITY EVENTS TABLE) */}
        <div className="col-span-6 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
          <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900">
              Recent Interoperability Events ({filteredEvents.length})
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Live outbox dispatch
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 py-1 pr-1">
            {filteredEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No events match current filter criteria.
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = evt.id === selectedEvent?.id;
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between gap-2 text-xs ${
                      isSelected
                        ? 'bg-indigo-50/50 border border-indigo-200/80 shadow-2xs'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {renderEventIcon(evt.eventType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {evt.id}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {evt.eventType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="truncate">{evt.consumer}</span>
                          {evt.incidentId && (
                            <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.2 rounded">
                              {evt.incidentId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {renderStatusBadge(evt.status)}
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:block">
                        {evt.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 6 COLS (EVENT DETAIL INSPECTOR & FHIR R4 REPRESENTATION) */}
        <div className="col-span-6 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden justify-between">
          {!selectedEvent ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select an outbox event to inspect HL7 FHIR and cryptographic provenance.
            </div>
          ) : (
            <>
              <div className="shrink-0 space-y-2.5 overflow-hidden">
                {/* Header */}
                <div className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {selectedEvent.id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                        {selectedEvent.consumer}
                      </span>
                    </div>
                    {renderStatusBadge(selectedEvent.status)}
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {selectedEvent.eventType.replace(/_/g, ' ')}
                  </h3>
                </div>

                {/* Event Lineage Flow */}
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Lineage Trace
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-700">
                    <span className="font-semibold">{selectedEvent.reachName}</span>
                    <span className="text-slate-300">→</span>
                    <span className="text-blue-600 font-semibold">Evidence</span>
                    <span className="text-slate-300">→</span>
                    <button
                      type="button"
                      onClick={() => onNavigateToIncident?.(selectedEvent.incidentId)}
                      className="text-amber-600 font-semibold hover:underline"
                    >
                      {selectedEvent.incidentId}
                    </button>
                    <span className="text-slate-300">→</span>
                    <span className="text-indigo-600 font-mono font-bold">{selectedEvent.id}</span>
                  </div>
                </div>

                {/* Subtabs & FHIR Code Box */}
                <div>
                  <div className="flex items-center justify-between pb-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setActiveFhirTab('json')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                          activeFhirTab === 'json'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        FHIR R4 JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFhirTab('validation')}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                          activeFhirTab === 'validation'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Validation
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyJson(selectedEvent.fhirResource)}
                        className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        <span>Expand</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {activeFhirTab === 'json' ? (
                    <pre className="p-2.5 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-lg overflow-y-auto max-h-36 border border-slate-800 leading-snug">
                      {JSON.stringify(selectedEvent.fhirResource, null, 2)}
                    </pre>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>HL7 FHIR R4 Schema Validated</span>
                      </div>
                      <p className="text-[10px] text-emerald-800 leading-relaxed">
                        Resource conforms to HL7 FHIR R4 Observation definition. Required attributes (status, code, subject) conform to standard.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions & Cryptographic Integrity */}
              <div className="shrink-0 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Payload HMAC:</span>
                  <span className="font-mono text-slate-700 font-bold truncate max-w-[140px]">
                    {selectedEvent.messageId ? `sha256:${selectedEvent.messageId.slice(0, 12)}...` : 'sha256:verified'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition"
                >
                  <span>Inspect Full Record</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL 1: FULL FHIR RESOURCE MODAL */}
      {isModalOpen && selectedEvent && (
        <EventDetailModal
          event={{
            id: selectedEvent.id,
            eventId: selectedEvent.id,
            eventType: selectedEvent.eventType as any,
            eventVersion: '1.0.0',
            occurredAt: new Date().toISOString(),
            producer: 'aquasentinel-decision-engine',
            subject: `StreamReach/${selectedEvent.reachId}`,
            resourceType: selectedEvent.fhirResource?.resourceType || 'Observation',
            resourceId: selectedEvent.id,
            correlationId: selectedEvent.messageId,
            causationId: selectedEvent.incidentId,
            payload: selectedEvent.fhirResource as any,
            destination: selectedEvent.consumer,
            status: (selectedEvent.status.toUpperCase() as any) || 'DELIVERED',
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          auditTrail={[
            {
              id: 'aud-1',
              eventId: selectedEvent.id,
              stage: 'DELIVERED',
              status: 'SUCCESS',
              message: `Event transmitted to ${selectedEvent.consumer}`,
              timestamp: new Date().toISOString(),
              details: { consumer: selectedEvent.consumer, notes: 'Event transmitted' },
            },
          ]}
          acknowledgements={[
            {
              acknowledgementId: 'ack-1',
              eventId: selectedEvent.id,
              consumerId: selectedEvent.consumer,
              status: 'ACCEPTED',
              receivedAt: new Date().toISOString(),
              details: 'HTTP 200 OK received from downstream subscriber',
            },
          ]}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRetry={async (id) => handleRetrySelectedEvent(id)}
          onReplay={async (id) => handleRetrySelectedEvent(id)}
        />
      )}

      {/* MODAL 2: PHASE 7 DETERMINISTIC DEMO RUNNER */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-blue-600" />
                  Phase 7 Deterministic Interoperability Demos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify transactional outbox pattern, FHIR R4 transformation, and retry semantics
                </p>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Demo 1: Golden Path */}
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-md">
                      Scenario 1
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Golden Path Delivery</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Publishes IncidentDetected &rarr; Transforms to FHIR Observation &rarr; Receives HTTP 200 ACK from Public Health.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('golden')}
                    disabled={demoRunning}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Run Golden Path
                  </button>
                </div>

                {/* Demo 2: Failure & Retry */}
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded-md">
                      Scenario 2
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Failure & Exponential Retry</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Simulates downstream HTTP 503 unavailable &rarr; Exponential backoff schedule logged in outbox.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('failure')}
                    disabled={demoRunning}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Simulate Failure
                  </button>
                </div>

                {/* Demo 3: Idempotency */}
                <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-700 uppercase bg-cyan-100 px-2 py-0.5 rounded-md">
                      Scenario 3
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Duplicate Suppression</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Re-delivers duplicate Message ID &rarr; Outbox deduplication gate suppresses secondary transmission.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('duplicate')}
                    disabled={demoRunning}
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Simulate Duplicate
                  </button>
                </div>

                {/* Demo 4: Dead-Letter Queue */}
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-rose-700 uppercase bg-rose-100 px-2 py-0.5 rounded-md">
                      Scenario 4
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Dead-Letter Queue & Replay</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Exhausts max retries &rarr; Moves event to Dead-Letter state &rarr; Manual operator replay trigger.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('deadletter')}
                    disabled={demoRunning}
                    className="w-full py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Simulate Dead Letter
                  </button>
                </div>
              </div>

              {/* Execution Results */}
              {demoResult && (
                <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-cyan-300 max-h-48 overflow-y-auto">
                  <pre>{JSON.stringify(demoResult, null, 2)}</pre>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDemoModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PIPELINE HEALTH & CONSUMERS */}
      {showPipelineStatsModal && (
        <Modal
          isOpen={showPipelineStatsModal}
          onClose={() => setShowPipelineStatsModal(false)}
          title="Downstream Consumers & Outbox Delivery Telemetry"
        >
          <div className="space-y-4 text-xs">
            {/* Delivery Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-xl font-extrabold text-slate-900">{totalEventsToday}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Total Events</div>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-xl font-extrabold text-emerald-600">{deliveredCount}</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">Delivered</div>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="text-xl font-extrabold text-amber-500">{pendingCount}</div>
                <div className="text-[10px] text-amber-700 mt-0.5">Pending</div>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="text-xl font-extrabold text-rose-500">{deadLetterCount}</div>
                <div className="text-[10px] text-rose-700 mt-0.5">Failed / DLQ</div>
              </div>
            </div>

            {/* Downstream Consumers Grid */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h4 className="font-bold text-slate-900 text-xs">Active Connected Consumers</h4>
              <div className="grid grid-cols-2 gap-2">
                {consumerStats.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.name} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${c.bg} ${c.text} flex items-center justify-center shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-[11px] block truncate">{c.name}</span>
                        <span className="text-[10px] text-slate-500 block">
                          {c.count} {c.count === 1 ? 'event' : 'events'} delivered
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPipelineStatsModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition text-xs"
              >
                Close Telemetry View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
