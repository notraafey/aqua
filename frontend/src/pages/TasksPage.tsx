import React, { useState, useMemo } from 'react';
import { Task } from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import { Modal } from '../components/common/Modal.js';
import {
  Search,
  ChevronDown,
  User,
  FlaskConical,
  Wrench,
  FileCheck,
  Compass,
  Clock,
  Calendar,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Check,
  Activity,
  Layers,
} from 'lucide-react';
import { formatRelativeTime } from '../utils/date.js';

interface TasksPageProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (id: string | null) => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onNavigateToFieldOps?: (taskId?: string) => void;
  onRefresh: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  tasks,
  selectedTaskId: initialSelectedId = null,
  onSelectTask,
  onNavigateToIncident,
  onNavigateToFieldOps,
  onRefresh,
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(initialSelectedId);
  const [activeFilterTab, setActiveFilterTab] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<boolean>(false);
  const [showWorkloadModal, setShowWorkloadModal] = useState<boolean>(false);

  // Real tasks from application state
  const allTasks = useMemo(() => tasks || [], [tasks]);

  const activeSelectedId = initialSelectedId || internalSelectedId || allTasks[0]?.id;

  const handleSelectTask = (id: string) => {
    setInternalSelectedId(id);
    if (onSelectTask) onSelectTask(id);
  };

  const selectedTask = allTasks.find((t) => t.id === activeSelectedId) || allTasks[0];

  // Update status
  const handleUpdateStatus = async (newStatus: Task['status']) => {
    if (!selectedTask) return;
    setStatusDropdownOpen(false);
    setIsUpdatingStatus(true);
    try {
      await apiClient.updateTaskStatus(selectedTask.id, { status: newStatus });
      onRefresh();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filter calculations
  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      // Subtab filter
      if (activeFilterTab === 'ASSIGNED_TO_ME') {
        if (!t.assignedTo?.toLowerCase().includes('team a') && !t.assignedTo?.toLowerCase().includes('alex')) return false;
      } else if (activeFilterTab === 'IN_PROGRESS') {
        if (t.status !== 'IN_PROGRESS') return false;
      } else if (activeFilterTab === 'OVERDUE') {
        if (t.priority !== 'URGENT' && t.priority !== 'HIGH' && t.status === 'COMPLETED') return false;
      } else if (activeFilterTab === 'COMPLETED') {
        if (t.status !== 'COMPLETED' && t.status !== 'VERIFIED') return false;
      }

      // Secondary filters
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== 'ALL' && t.assignedTo !== assigneeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesIncident = t.incidentId.toLowerCase().includes(q);
        const matchesAssignee = (t.assignedTo || '').toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesIncident && !matchesAssignee) return false;
      }

      return true;
    });
  }, [allTasks, activeFilterTab, statusFilter, priorityFilter, assigneeFilter, searchQuery]);

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'URGENT':
      case 'HIGH':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'LOW':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status: Task['status']) => {
    switch (status) {
      case 'ASSIGNED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'IN_PROGRESS':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'COMPLETED':
      case 'VERIFIED':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getTaskIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('verification') || t.includes('field')) return User;
    if (t.includes('sample')) return FlaskConical;
    if (t.includes('upstream') || t.includes('inspect')) return Search;
    if (t.includes('equipment') || t.includes('deploy')) return Wrench;
    if (t.includes('remediation') || t.includes('verify')) return FileCheck;
    return Wrench;
  };

  const getAssigneeInitials = (assignedTo?: string) => {
    if (!assignedTo) return 'AP';
    const words = assignedTo.split(' ');
    if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
    return assignedTo.substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden text-slate-800">
      {/* 1. TOP HEADER STRIP & CONTROLS */}
      <div className="shrink-0 h-11 bg-white border border-slate-200/90 rounded-xl px-3 py-1 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
            <Layers size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                Operational Tasks Console
              </h1>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                {filteredTasks.length} Tasks Active
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate hidden sm:block">
              Field crew assignment, verification workflows, and lifecycle execution tracking.
            </p>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-7 pr-2.5 py-1 text-[11px] bg-slate-50 border border-slate-200/90 rounded-lg w-32 md:w-44 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative hidden md:block">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg pl-2 pr-5 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Priority Dropdown */}
          <div className="relative hidden lg:block">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg pl-2 pr-5 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Assignee Dropdown */}
          <div className="relative hidden xl:block">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg pl-2 pr-5 py-1 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Teams</option>
              <option value="Field Ops Crew Alpha">Crew Alpha</option>
              <option value="Rapid Response Unit 2">Response Unit 2</option>
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Workload Modal Trigger */}
          <button
            type="button"
            onClick={() => setShowWorkloadModal(true)}
            className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-2xs transition"
          >
            <Activity size={12} className="text-blue-600" />
            <span>Workload Stats</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            title="Refresh Tasks"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* 2. ZERO-SCROLL 2-COLUMN SPLIT CONSOLE */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5">
        {/* LEFT COLUMN: 7 COLS (TASK TABLE / QUEUE WITH SUBTABS) */}
        <div className="col-span-7 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
          {/* Subtab Filter Strip */}
          <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1">
              {[
                { id: 'ALL', label: 'All Tasks', count: allTasks.length },
                { id: 'IN_PROGRESS', label: 'In Progress', count: allTasks.filter(t => t.status === 'IN_PROGRESS').length },
                { id: 'ASSIGNED_TO_ME', label: 'My Crew', count: allTasks.filter(t => t.assignedTo?.toLowerCase().includes('team a')).length },
                { id: 'COMPLETED', label: 'Completed', count: allTasks.filter(t => t.status === 'COMPLETED' || t.status === 'VERIFIED').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilterTab(tab.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 ${
                    activeFilterTab === tab.id
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded-full ${
                    activeFilterTab === tab.id ? 'bg-blue-200/60 text-blue-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <span className="text-[10px] text-slate-400 font-mono">
              Auto-sync active
            </span>
          </div>

          {/* Task Queue List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 py-1 pr-1">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tasks match current filter criteria.
              </div>
            ) : (
              filteredTasks.map((task) => {
                const IconComponent = getTaskIcon(task.title);
                const isSelected = task.id === selectedTask?.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectTask(task.id)}
                    className={`p-2.5 rounded-lg transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-blue-50/50 border border-blue-200/80 shadow-2xs'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <IconComponent size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate">
                            {task.title}
                          </span>
                          <span className="font-mono text-[9px] text-slate-400 shrink-0">
                            {task.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="truncate">
                            {task.assignedTo || 'Unassigned'}
                          </span>
                          {task.incidentId && (
                            <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.2 rounded">
                              {task.incidentId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getStatusBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: 5 COLS (SELECTED TASK DETAIL INSPECTOR & LIFECYCLE) */}
        <div className="col-span-5 flex flex-col min-h-0 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs overflow-hidden justify-between">
          {selectedTask ? (
            <>
              <div className="shrink-0 space-y-2.5 overflow-hidden">
                {/* Header */}
                <div className="pb-2 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {selectedTask.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(selectedTask.status)}`}>
                      {selectedTask.status}
                    </span>
                  </div>
                  <h2 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                    {selectedTask.title}
                  </h2>
                  <p className="text-slate-500 text-[10px] line-clamp-1 mt-0.5">
                    {selectedTask.description || selectedTask.instructions || 'Standard response task execution.'}
                  </p>
                </div>

                {/* 3 Key Metrics Row */}
                <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Priority
                    </span>
                    <span className="text-xs font-bold text-rose-600 block mt-0.5">
                      {selectedTask.priority}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Due
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Calendar size={10} className="text-blue-500" />
                      <span className="text-[11px] font-bold text-slate-800">
                        {selectedTask.dueAt ? formatRelativeTime(selectedTask.dueAt) : '< 4h'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      Assigned Crew
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[8px] flex items-center justify-center shrink-0">
                        {getAssigneeInitials(selectedTask.assignedTo)}
                      </div>
                      <span className="text-[11px] font-bold text-slate-800 truncate">
                        {selectedTask.assignedTo || 'Alpha Crew'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="space-y-1.5 py-0.5 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Compass size={11} className="text-blue-500" />
                      <span>Target reach</span>
                    </span>
                    <span className="font-semibold text-slate-900">
                      {selectedTask.title.includes('—')
                        ? selectedTask.title.split('—')[1].trim()
                        : ((selectedTask as any).reachId || 'Basin Reach')}
                    </span>
                  </div>

                  {selectedTask.incidentId && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-slate-400">
                        <ShieldAlert size={11} className="text-rose-500" />
                        <span>Incident Link</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateToIncident?.(selectedTask.incidentId)}
                        className="font-mono text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        {selectedTask.incidentId}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock size={11} className="text-slate-400" />
                      <span>Created</span>
                    </span>
                    <span className="text-slate-700 font-mono text-[10px]">
                      {formatRelativeTime(selectedTask.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Task Lifecycle Stepper */}
                <div className="pt-1 border-t border-slate-100">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Task lifecycle
                  </h4>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[
                      { step: 'Created', done: true },
                      { step: 'Assigned', done: !!selectedTask.assignedTo },
                      { step: 'In Progress', done: selectedTask.status === 'IN_PROGRESS' || selectedTask.status === 'COMPLETED' },
                      { step: 'Complete', done: selectedTask.status === 'COMPLETED' || selectedTask.status === 'VERIFIED' },
                    ].map((s, idx) => (
                      <div
                        key={idx}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-0.5 ${
                          s.done
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] ${
                          s.done ? 'bg-blue-600 text-white' : 'bg-slate-300 text-white'
                        }`}>
                          {s.done ? '✓' : idx + 1}
                        </div>
                        <span className="truncate">{s.step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 pt-2 border-t border-slate-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateToFieldOps && onNavigateToFieldOps(selectedTask.id)}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-2xs"
                  >
                    <span>Field Operation</span>
                    <ExternalLink size={12} />
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                      disabled={isUpdatingStatus}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <span>Update status</span>
                      <ChevronDown size={12} />
                    </button>

                    {statusDropdownOpen && (
                      <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-30 space-y-0.5">
                        {(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleUpdateStatus(s)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            <span>{s.replace(/_/g, ' ')}</span>
                            {selectedTask.status === s && <Check size={12} className="text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Select a task to inspect operational details.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Workload Analytics & Recent Activity */}
      {showWorkloadModal && (
        <Modal
          isOpen={showWorkloadModal}
          onClose={() => setShowWorkloadModal(false)}
          title="Operational Workload & Task Activity Log"
        >
          <div className="space-y-4 text-xs">
            {/* 4 Workload Metric Cards */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <span className="text-xl font-bold text-blue-900 block leading-tight">18</span>
                <span className="text-[11px] text-blue-700 font-semibold block mt-0.5">Open Tasks</span>
              </div>

              <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                <span className="text-xl font-bold text-sky-900 block leading-tight">6</span>
                <span className="text-[11px] text-sky-700 font-semibold block mt-0.5">In Progress</span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="text-xl font-bold text-emerald-900 block leading-tight">31</span>
                <span className="text-[11px] text-emerald-700 font-semibold block mt-0.5">Completed</span>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                <span className="text-xl font-bold text-rose-900 block leading-tight">2</span>
                <span className="text-[11px] text-rose-700 font-semibold block mt-0.5">Blocked</span>
              </div>
            </div>

            {/* Recent Activity Timeline List */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h4 className="font-bold text-slate-800 text-xs">Recent Operations Feed</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {allTasks.slice(0, 5).map((t, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="font-mono text-[10px] text-blue-600">{t.id.slice(0, 8)}</span>
                        <span>{t.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Assigned to {t.assignedTo || 'Operations Lead'} · Status: {t.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {formatRelativeTime(t.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowWorkloadModal(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition text-xs"
              >
                Close Workload View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
