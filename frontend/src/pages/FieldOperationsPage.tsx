import React, { useState, useEffect } from 'react';
import { Task, Verification, OperationalOutcomeType, StreamReach } from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import { formatRelativeTime } from '../utils/date.js';
import { ResponseAnalyticsView } from '../components/analytics/ResponseAnalyticsView.js';
import { OutcomeReviewModal } from '../components/incidents/OutcomeReviewModal.js';
import {
  Search,
  ChevronDown,
  Calendar,
  Waves,
  AlertTriangle,
  Users,
  FileText,
  Check,
  Clock,
  Camera,
  MoreHorizontal,
  Radio,
  Plus,
  RefreshCw,
  PlayCircle,
  X,
  BarChart3,
  Bookmark,
  ArrowRight,
} from 'lucide-react';

interface FieldOperationsPageProps {
  defaultTab?: 'verifications' | 'analytics' | 'demo';
  tasks?: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onRefresh?: () => void;
}

interface FieldObservationItem {
  id: string;
  type: 'sample' | 'measurement' | 'visual' | 'custom';
  title: string;
  time: string;
  subtitle: string;
  image?: string;
  details?: Record<string, string | number>;
  author?: string;
}

interface TimelineActivityItem {
  id: string;
  time: string;
  title: string;
  author: string;
  isSystem?: boolean;
}

export const FieldOperationsPage: React.FC<FieldOperationsPageProps> = ({
  defaultTab = 'verifications',
  tasks = [],
  selectedTaskId = null,
  onSelectTask,
  onNavigateToIncident,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'verifications' | 'analytics' | 'demo'>(defaultTab);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Drawers
  const [isAddObservationOpen, setIsAddObservationOpen] = useState(false);
  const [isUpdateProgressOpen, setIsUpdateProgressOpen] = useState(false);
  const [isContactTeamOpen, setIsContactTeamOpen] = useState(false);
  const [isEditAssignmentOpen, setIsEditAssignmentOpen] = useState(false);
  const [isViewAllActivityOpen, setIsViewAllActivityOpen] = useState(false);
  const [selectedPhotoDetail, setSelectedPhotoDetail] = useState<FieldObservationItem | null>(null);
  const [showDemoRunnerModal, setShowDemoRunnerModal] = useState(false);

  // Outcome Review Modal
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewIncidentId, setReviewIncidentId] = useState<string>('');
  const [reviewProposedOutcome, setReviewProposedOutcome] = useState<string>('CONFIRMED');

  // Editable Assignment State
  const [scheduledWindow, setScheduledWindow] = useState('Standard Operations Window');
  const [assignedTeamName, setAssignedTeamName] = useState('Field Operations Team');
  const [assignedPriority, setAssignedPriority] = useState('High');

  // Demo Runner State
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult] = useState<any | null>(null);

  // Active Lifecycle Stage (0: Preparation, 1: Dispatch, 2: On site, 3: Data collection, 4: Complete)
  const [activeStage, setActiveStage] = useState<number>(2);

  // Dynamic Observations State
  const [observations, setObservations] = useState<FieldObservationItem[]>([]);

  // Dynamic Recent Activity Timeline
  const [activities, setActivities] = useState<TimelineActivityItem[]>([]);
  const [reaches, setReaches] = useState<StreamReach[]>([]);

  // New Observation Form State
  const [newObsType, setNewObsType] = useState<'sample' | 'measurement' | 'visual' | 'custom'>('measurement');
  const [newObsTitle, setNewObsTitle] = useState('');
  const [newObsSubtitle, setNewObsSubtitle] = useState('');
  const [newObsNotes, setNewObsNotes] = useState('');

  // Find currently selected task
  const activeTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const reachData = reaches.find((r) => r.id === (activeTask as any)?.reachId) || reaches[0] || null;

  const loadVerifications = async () => {
    try {
      setLoadingVerifications(true);
      const [res, reachesRes] = await Promise.all([
        apiClient.getVerifications().catch(() => []),
        apiClient.getStreamReaches().catch(() => []),
      ]);
      if (Array.isArray(reachesRes)) setReaches(reachesRes);
      const data = Array.isArray(res) ? res : [];
      setVerifications(data);
      if (data.length > 0) {
        const mappedObs: FieldObservationItem[] = data.map((v, i) => {
          const obsTime = v.timestamp || (v as any).verifiedAt;
          const inspectorName = typeof v.inspector === 'object' ? v.inspector?.name : (v as any).inspectorName || 'Field Team';
          return {
            id: v.id || `obs-${i}`,
            type: 'sample',
            title: v.notes || 'Ground truth verification recorded',
            time: obsTime ? formatRelativeTime(obsTime) : 'Recent',
            subtitle: `Status: ${v.status} | Inspector: ${inspectorName}`,
            author: inspectorName,
            details: {
              'Status': v.status,
              'Inspector': inspectorName,
              'Notes': v.notes || 'Inspection complete',
              'Incident ID': v.incidentId || 'Incident',
            },
          };
        });
        setObservations(mappedObs);
        const mappedActs: TimelineActivityItem[] = data.map((v, i) => {
          const actTime = v.timestamp || (v as any).verifiedAt;
          const inspectorName = typeof v.inspector === 'object' ? v.inspector?.name : (v as any).inspectorName || 'Field Inspector';
          return {
            id: `act-${v.id || i}`,
            time: actTime ? formatRelativeTime(actTime) : 'Recent',
            title: v.notes || `Verification status: ${v.status}`,
            author: inspectorName,
          };
        });
        setActivities(mappedActs);
      } else {
        setObservations([]);
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to load verifications', err);
      setVerifications([]);
      setObservations([]);
      setActivities([]);
    } finally {
      setLoadingVerifications(false);
    }
  };

  useEffect(() => {
    loadVerifications();
  }, []);

  const handleConfirmOutcome = async (outcomeType: OperationalOutcomeType, notes: string) => {
    if (!reviewIncidentId) return;
    await apiClient.confirmIncidentOutcome(reviewIncidentId, {
      outcomeType,
      notes,
      confirmedBy: 'Alex Patel (Lead Operator)',
    });
    await loadVerifications();
    if (onRefresh) onRefresh();
  };

  const runDemoScenario = async (scenario: 'A' | 'B' | 'C' | 'ALL') => {
    try {
      setDemoLoading(true);
      setDemoResult(null);
      let res;
      if (scenario === 'A') res = await apiClient.runPhase8ScenarioA();
      else if (scenario === 'B') res = await apiClient.runPhase8ScenarioB();
      else if (scenario === 'C') res = await apiClient.runPhase8ScenarioC();
      else res = await apiClient.runPhase8ExecuteAll();
      setDemoResult(res);
      await loadVerifications();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setDemoResult({ error: err.message || 'Execution failed' });
    } finally {
      setDemoLoading(false);
    }
  };

  const handleAddObservationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObsTitle) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const newObs: FieldObservationItem = {
      id: `obs-${Date.now()}`,
      type: newObsType,
      title: newObsTitle,
      time: timeStr,
      subtitle: newObsSubtitle || newObsNotes || 'Field observation logged',
      image:
        newObsType === 'sample'
          ? '/assets/field_sample.png'
          : newObsType === 'measurement'
          ? '/assets/field_meter.png'
          : '/assets/field_river.png',
      author: 'Alex Patel',
      details: {
        'Notes': newObsNotes || 'Observation registered on site',
        'Timestamp': `${new Date().toLocaleDateString()} ${timeStr}`,
        'Logged By': 'Alex Patel (Lead operator)',
      },
    };

    setObservations([newObs, ...observations]);
    setActivities([
      { id: `act-${Date.now()}`, time: timeStr, title: `${newObsTitle} logged`, author: 'Alex Patel' },
      ...activities,
    ]);

    setNewObsTitle('');
    setNewObsSubtitle('');
    setNewObsNotes('');
    setIsAddObservationOpen(false);
  };

  const handleStageSelect = (stageIdx: number) => {
    setActiveStage(stageIdx);
    const stageNames = ['Preparation', 'Dispatch', 'On site', 'Data collection', 'Complete'];
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    setActivities([
      { id: `act-${Date.now()}`, time: timeStr, title: `Operation advanced to ${stageNames[stageIdx]}`, author: 'Alex Patel' },
      ...activities,
    ]);
    if (stageIdx === 4) {
      setReviewIncidentId(activeTask?.incidentId || '');
      setReviewProposedOutcome('CONFIRMED');
      setIsReviewOpen(true);
    }
  };

  // If user selected analytics tab from ResponseOperationsPage
  if (activeTab === 'analytics') {
    return (
      <div className="h-full flex flex-col min-h-0 overflow-hidden text-slate-800">
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Intervention & Operational Analytics</h2>
          </div>
          <button
            onClick={() => setActiveTab('verifications')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1.5"
          >
            ← Back to Field Operations
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pt-2">
          <ResponseAnalyticsView />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="shrink-0 h-11 bg-white border border-slate-200/90 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
            <Bookmark className="w-3.5 h-3.5 fill-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Field Operations Command
              </h1>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                ISO 22320 / On-Site Ground Truth
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate hidden sm:block">
              Monitor active field work, execution progress, and sensor truth validation.
            </p>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Field */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search field ops..."
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
              <option value="IN_PROGRESS">In progress</option>
              <option value="ON_SITE">On site</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Deterministic Demos Trigger Button */}
          <button
            type="button"
            onClick={() => setShowDemoRunnerModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold shadow-2xs transition"
            title="Open Phase 8 Deterministic Scenario Runner"
          >
            <PlayCircle className="w-3.5 h-3.5 text-blue-600" />
            <span>Deterministic Demos</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => { loadVerifications(); onRefresh?.(); }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Refresh Field Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingVerifications ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN GRID (8 COLS LEFT, 4 COLS RIGHT) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 items-stretch">
        {/* LEFT COLUMN: ACTIVE FIELD OPERATION & OBSERVATIONS (8 COLS) */}
        <div className="col-span-8 flex flex-col min-h-0 gap-2 overflow-hidden">
          {/* CARD 1: ACTIVE FIELD OPERATION */}
          <div className="shrink-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs space-y-2">
            {/* Operation Eyebrow & Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[10px] tracking-wider uppercase">
                <Bookmark className="w-3 h-3 fill-blue-600" />
                <span>FIELD OPERATION ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  IN PROGRESS
                </span>
                <button
                  type="button"
                  onClick={() => setIsUpdateProgressOpen(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Operation Title & Subtitle */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                {activeTask
                  ? `${activeTask.title} — ${(activeTask as any).reachId || 'Basin Reach'}`
                  : 'Field Operations & Ground Verification'}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                {activeTask?.description ||
                  'Ground inspection, confirmatory field sample collection, and sensor truth validation.'}
              </p>
            </div>

            {/* 4 Metadata Chips */}
            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100">
              {/* Task */}
              <div
                onClick={() => {
                  if (onSelectTask && activeTask?.id) {
                    onSelectTask(activeTask.id);
                  }
                }}
                className={`p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2 ${activeTask?.id ? 'cursor-pointer hover:bg-slate-100' : ''}`}
              >
                <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Task</span>
                  <span className="text-[11px] font-bold text-slate-900 truncate block">
                    {activeTask ? `TSK-${activeTask.id.slice(0, 4)}` : 'TSK-001'}
                  </span>
                </div>
              </div>

              {/* Incident */}
              <div
                onClick={() => {
                  if (onNavigateToIncident && activeTask?.incidentId) {
                    onNavigateToIncident(activeTask.incidentId);
                  }
                }}
                className={`p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2 ${activeTask?.incidentId ? 'cursor-pointer hover:bg-slate-100' : ''}`}
              >
                <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Incident</span>
                  <span className="text-[11px] font-bold text-slate-900 truncate block">
                    {activeTask?.incidentId ? `INC-${activeTask.incidentId.slice(0, 4)}` : 'INC-001'}
                  </span>
                </div>
              </div>

              {/* Reach */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Waves className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Reach</span>
                  <span className="text-[11px] font-bold text-slate-900 truncate block">
                    {reachData ? reachData.name : 'Reach-004'}
                  </span>
                </div>
              </div>

              {/* Team */}
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold">Crew</span>
                  <span className="text-[11px] font-bold text-slate-900 truncate block">
                    {assignedTeamName}
                  </span>
                </div>
              </div>
            </div>

            {/* Horizontal Lifecycle Stepper */}
            <div className="pt-2 border-t border-slate-100">
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {['Preparation', 'Dispatch', 'On site', 'Data collection', 'Complete'].map((stName, idx) => {
                  const isDone = activeStage >= idx;
                  const isCurrent = activeStage === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStageSelect(idx)}
                      className={`p-1.5 rounded-lg border transition text-left flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                          : isDone
                          ? 'bg-slate-50 border-slate-200 text-slate-700'
                          : 'bg-white border-slate-100 text-slate-400'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 font-bold ${
                        isDone ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span className="text-[10px] truncate">{stName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CARD 2: FIELD OBSERVATIONS */}
          <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  Field observations & Ground Verifications
                </h3>
                <p className="text-[10px] text-slate-500">
                  Multiparameter probe readings, chain-of-custody photos, and field notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddObservationOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold transition"
              >
                <Plus className="w-3 h-3" />
                <span>Add observation</span>
              </button>
            </div>

            {/* 4 Observation Cards Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-4 gap-2 pt-2 overflow-hidden">
              {/* Dynamic Items (first 3 from state) */}
              {observations.slice(0, 3).map((obs) => (
                <div
                  key={obs.id}
                  onClick={() => setSelectedPhotoDetail(obs)}
                  className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-blue-400 hover:shadow-xs cursor-pointer transition flex flex-col min-h-0"
                >
                  <div className="relative flex-1 min-h-[60px] bg-slate-100 overflow-hidden">
                    {obs.image ? (
                      <img
                        src={obs.image}
                        alt={obs.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <span className="absolute top-1.5 right-1.5 px-1 py-0.2 rounded bg-black/60 backdrop-blur-xs text-[9px] font-mono text-white">
                      {obs.time}
                    </span>
                  </div>
                  <div className="p-2 shrink-0 bg-white">
                    <h4 className="text-[11px] font-bold text-slate-900 truncate group-hover:text-blue-600 transition">
                      {obs.title}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {obs.subtitle}
                    </p>
                  </div>
                </div>
              ))}

              {/* 4th Card: Add Photo or Note Card */}
              <div
                onClick={() => setIsAddObservationOpen(true)}
                className="rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition flex flex-col items-center justify-center p-3 text-center group"
              >
                <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center mb-1 transition">
                  <Plus className="w-4 h-4" />
                </div>
                <h4 className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700">
                  Log Ground Evidence
                </h4>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Multiparameter probe / Photo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TEAM, ASSIGNMENT DETAILS, TIMELINE (4 COLS) */}
        <div className="col-span-4 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden justify-between">
          <div className="shrink-0 space-y-2.5">
            {/* CARD 1: FIELD TEAM */}
            <div className="pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold text-slate-900">
                  Field Response Team
                </h3>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  On site
                </span>
              </div>

              {/* Team Lead Profile */}
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/field_lead_alex.png"
                  alt="Alex Patel"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-100 shadow-2xs"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {assignedTeamName}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Lead: Alex Patel</span>
                    <button
                      type="button"
                      onClick={() => setIsContactTeamOpen(true)}
                      className="text-blue-600 hover:text-blue-700 font-semibold text-[10px]"
                    >
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: ASSIGNMENT DETAILS */}
            <div className="space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Waves className="w-3 h-3 text-blue-600" />
                  <span>Target Reach</span>
                </span>
                <span className="font-semibold text-slate-900 truncate max-w-[150px]">
                  {reachData ? reachData.name : 'Reach-004'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  <span>Scheduled Window</span>
                </span>
                <span className="font-medium text-slate-800">Today, 14:00 - 18:00</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Started</span>
                </span>
                <span className="font-medium text-slate-800">14:15 local</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <AlertTriangle className="w-3 h-3 text-rose-500" />
                  <span>Priority</span>
                </span>
                <span className={`font-bold ${assignedPriority === 'High' ? 'text-rose-600' : 'text-slate-800'}`}>
                  {assignedPriority}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Actions & Activity */}
          <div className="shrink-0 pt-2 border-t border-slate-100 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsUpdateProgressOpen(true)}
                className="py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
              >
                <span>Update progress</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setIsAddObservationOpen(true)}
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
              >
                <FileText className="w-3 h-3 text-slate-400" />
                <span>Add observation</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setReviewIncidentId(activeTask?.incidentId || '');
                setReviewProposedOutcome('CONFIRMED');
                setIsReviewOpen(true);
              }}
              className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Review Outcome & Close Task</span>
            </button>

            {/* Recent Activity Mini Strip */}
            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1 text-slate-500 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="truncate">Latest: {activities[0]?.title || 'En route to Reach'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsViewAllActivityOpen(true)}
                className="text-blue-600 hover:text-blue-700 font-semibold shrink-0 ml-1"
              >
                All Logs →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: ADD OBSERVATION MODAL */}
      {isAddObservationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Add Field Observation</h3>
              </div>
              <button
                onClick={() => setIsAddObservationOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddObservationSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Observation Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewObsType('measurement');
                      setNewObsTitle('In-situ measurement');
                      setNewObsSubtitle('pH: 7.3 | Turbidity: 15 NTU');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      newObsType === 'measurement'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Probe Telemetry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewObsType('sample');
                      setNewObsTitle('Water sample collected');
                      setNewObsSubtitle('Mid-channel composite sample');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      newObsType === 'sample'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Sample Bottle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewObsType('visual');
                      setNewObsTitle('Visual assessment');
                      setNewObsSubtitle('Normal river flow, no sheen');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      newObsType === 'visual'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Visual Check
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newObsTitle}
                  onChange={(e) => setNewObsTitle(e.target.value)}
                  placeholder="e.g. Dissolved oxygen spot-check"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Parameters / Summary
                </label>
                <input
                  type="text"
                  value={newObsSubtitle}
                  onChange={(e) => setNewObsSubtitle(e.target.value)}
                  placeholder="e.g. pH: 7.2 | DO: 6.8 mg/L"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Inspector Field Notes
                </label>
                <textarea
                  rows={3}
                  value={newObsNotes}
                  onChange={(e) => setNewObsNotes(e.target.value)}
                  placeholder="Record in-situ field conditions, geofence coordinates, sample barcode..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddObservationOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save Observation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: UPDATE PROGRESS MODAL */}
      {isUpdateProgressOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Update Operation Stage</h3>
              <button
                onClick={() => setIsUpdateProgressOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Advance or update the operational state for <strong>{activeTask ? `${activeTask.title} — ${(activeTask as any).reachId || 'Reach'}` : 'Field Operations'}</strong>:
              </p>

              <div className="space-y-2">
                {[
                  { idx: 0, name: 'Preparation', desc: 'Equipment checked, sample bottles prepped' },
                  { idx: 1, name: 'Dispatch', desc: 'En route to monitored reach' },
                  { idx: 2, name: 'On site', desc: 'Team arrived at river coordinates' },
                  { idx: 3, name: 'Data collection', desc: 'Sampling & probe measurement underway' },
                  { idx: 4, name: 'Complete', desc: 'Observations logged & ready for outcome triage' },
                ].map((st) => (
                  <button
                    key={st.idx}
                    type="button"
                    onClick={() => {
                      handleStageSelect(st.idx);
                      setIsUpdateProgressOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      activeStage === st.idx
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                        activeStage >= st.idx
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-400'
                      }`}
                    >
                      {activeStage > st.idx ? '✓' : st.idx + 1}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">{st.name}</span>
                      <span className="text-[11px] text-slate-500 block">{st.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsUpdateProgressOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONTACT TEAM MODAL */}
      {isContactTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Contact Field Team</h3>
              </div>
              <button
                onClick={() => setIsContactTeamOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/field_lead_alex.png"
                  alt="Alex Patel"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-100"
                />
                <div>
                  <h4 className="font-bold text-slate-900">Alex Patel (Lead)</h4>
                  <p className="text-slate-500">{assignedTeamName}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Radio Signal: Strong (Channel 14)
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">VHF Channel:</span>
                  <span className="font-mono font-bold text-slate-800">156.700 MHz (Ch 14)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Satellite Comms:</span>
                  <span className="font-mono font-semibold text-slate-800">+1 (555) 019-4821</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500">Mobile Hotspot:</span>
                  <span className="font-semibold text-emerald-600">Online (LTE Backup)</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    alert('Connecting radio audio channel to Field Operations Team A...');
                    setIsContactTeamOpen(false);
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Connect Voice
                </button>
                <button
                  type="button"
                  onClick={() => setIsContactTeamOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT ASSIGNMENT MODAL */}
      {isEditAssignmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Assignment Details</h3>
              <button
                onClick={() => setIsEditAssignmentOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-600 font-semibold block mb-1">Assigned Team</label>
                <input
                  type="text"
                  value={assignedTeamName}
                  onChange={(e) => setAssignedTeamName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Scheduled Window</label>
                <input
                  type="text"
                  value={scheduledWindow}
                  onChange={(e) => setScheduledWindow(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 font-semibold block mb-1">Priority</label>
                <select
                  value={assignedPriority}
                  onChange={(e) => setAssignedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditAssignmentOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditAssignmentOpen(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: VIEW ALL ACTIVITY / GROUND VERIFICATIONS LOG */}
      {isViewAllActivityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Comprehensive Field Activity Log</h3>
                <p className="text-xs text-slate-500">
                  Full chronological audit trail and ground truth sync records ({activities.length} events, {verifications.length} synced records)
                </p>
              </div>
              <button
                onClick={() => setIsViewAllActivityOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-3">
                {activities.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400">{item.time}</span>
                      <span className="font-semibold text-slate-800">{item.title}</span>
                    </div>
                    <span className="text-slate-500 font-medium">{item.author}</span>
                  </div>
                ))}

                {loadingVerifications && (
                  <div className="text-center py-4 text-xs text-slate-400">Loading ground sync records...</div>
                )}

                {verifications.length > 0 && (
                  <div className="pt-3 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Synced Backend Verifications</h4>
                    <div className="space-y-2">
                      {verifications.map((v) => (
                        <div key={v.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                          <div>
                            <span className="font-mono font-bold text-blue-600">ID: {v.id.slice(0, 8)}</span>
                            <span className="ml-2 text-slate-600">{v.notes || 'Ground inspection verified'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            {v.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsViewAllActivityOpen(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: OBSERVATION DETAIL / PHOTO INSPECTOR */}
      {selectedPhotoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono text-blue-600 uppercase font-semibold">
                  Field Evidence • {selectedPhotoDetail.time}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedPhotoDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPhotoDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {selectedPhotoDetail.image && (
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xs max-h-64 bg-slate-950 flex items-center justify-center">
                  <img
                    src={selectedPhotoDetail.image}
                    alt={selectedPhotoDetail.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {selectedPhotoDetail.subtitle}
              </p>

              {selectedPhotoDetail.details && (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Telemetry & Chain of Custody
                  </span>
                  {Object.entries(selectedPhotoDetail.details).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">{key}:</span>
                      <span className="font-semibold text-slate-900">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-between items-center text-xs">
                <span className="text-slate-400">
                  Logged by: <strong className="text-slate-700">{selectedPhotoDetail.author || 'Alex Patel'}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPhotoDetail(null)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: DETERMINISTIC DEMO RUNNER MODAL */}
      {showDemoRunnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-blue-600" />
                  Deterministic Closed-Loop Response Scenarios
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Execute Phase 8 scenarios to verify autonomous dispatch, false-alarm suppression, and follow-up
                </p>
              </div>
              <button
                onClick={() => setShowDemoRunnerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Scenario A */}
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-md">
                      Scenario A
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Confirmed Contamination</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Satellite NDCI anomaly → Task assigned → Inspector observes green foam → Proposes CONFIRMED.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('A')}
                    disabled={demoLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Run Scenario A
                  </button>
                </div>

                {/* Scenario B */}
                <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-cyan-700 uppercase bg-cyan-100 px-2 py-0.5 rounded-md">
                      Scenario B
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">False Alarm</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Remote sensing artifact → Inspector verifies clean water → NOT_CONFIRMED proposed & archived.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('B')}
                    disabled={demoLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Run Scenario B
                  </button>
                </div>

                {/* Scenario C */}
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-100 px-2 py-0.5 rounded-md">
                      Scenario C
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 mt-1.5">Uncertain / Follow-Up</h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Ambiguous brown runoff → ADDITIONAL_VERIFICATION_REQUIRED → Secondary lab sampling triggered.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runDemoScenario('C')}
                    disabled={demoLoading}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs disabled:opacity-50"
                  >
                    Run Scenario C
                  </button>
                </div>
              </div>

              {/* Run All */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Execute End-to-End Test Suite</h4>
                  <p className="text-[11px] text-slate-500">Run all 3 deterministic scenarios sequentially</p>
                </div>
                <button
                  type="button"
                  onClick={() => runDemoScenario('ALL')}
                  disabled={demoLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${demoLoading ? 'animate-spin' : ''}`} />
                  <span>{demoLoading ? 'Running...' : 'Execute All 3'}</span>
                </button>
              </div>

              {/* Execution Results */}
              {demoResult && (
                <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-cyan-300 max-h-48 overflow-y-auto">
                  <pre>{JSON.stringify(demoResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OUTCOME REVIEW MODAL */}
      <OutcomeReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        incidentId={reviewIncidentId}
        proposedOutcome={reviewProposedOutcome}
        onConfirm={handleConfirmOutcome}
      />
    </div>
  );
};
