import React, { useState } from 'react';
import { Task } from '@aquasentinel/shared';
import { RecommendationsPage } from './RecommendationsPage.js';
import { TasksPage } from './TasksPage.js';
import { FieldOperationsPage } from './FieldOperationsPage.js';
import { Sparkles, CheckSquare, ClipboardCheck, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

export type ResponseOperationsSubTab = 'recommendations' | 'tasks' | 'field-ops' | 'analytics';

interface ResponseOperationsPageProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  onNavigateToIncident?: (incidentId: string) => void;
  onRefresh: () => void;
  initialSubTab?: ResponseOperationsSubTab;
}

export const ResponseOperationsPage: React.FC<ResponseOperationsPageProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onNavigateToIncident,
  onRefresh,
  initialSubTab = 'recommendations',
}) => {
  const [subTab, setSubTab] = useState<ResponseOperationsSubTab>(initialSubTab);

  React.useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const activeTasksCount = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;

  return (
    <div className="h-full flex flex-col min-h-0 gap-2 overflow-hidden select-none">
      {/* Subtab Navigation Switcher */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setSubTab('recommendations')}
            className={clsx(
              'flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
              subTab === 'recommendations'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            <Sparkles size={13} className={subTab === 'recommendations' ? 'text-cyan-400' : 'text-slate-400'} />
            <span>Response Engine</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('tasks')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
              subTab === 'tasks'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            <CheckSquare size={13} className={subTab === 'tasks' ? 'text-cyan-400' : 'text-slate-400'} />
            <span>Operational Tasks</span>
            {activeTasksCount > 0 && (
              <span className={clsx(
                'text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold',
                subTab === 'tasks' ? 'bg-slate-800 text-cyan-300' : 'bg-slate-100 text-slate-700'
              )}>
                {activeTasksCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('field-ops')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
              subTab === 'field-ops'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            <ClipboardCheck size={13} className={subTab === 'field-ops' ? 'text-cyan-400' : 'text-slate-400'} />
            <span>Field Verifications</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('analytics')}
            className={clsx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap',
              subTab === 'analytics'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            <BarChart3 size={13} className={subTab === 'analytics' ? 'text-cyan-400' : 'text-slate-400'} />
            <span>Intervention Analytics</span>
          </button>
        </div>
      </div>

      {/* Subtab Contents */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {subTab === 'recommendations' && (
          <RecommendationsPage
            onRefresh={onRefresh}
            onNavigateToIncident={onNavigateToIncident}
            onNavigateToTask={(taskId) => {
              onSelectTask(taskId);
              setSubTab('tasks');
            }}
          />
        )}

        {subTab === 'tasks' && (
          <TasksPage
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onNavigateToIncident={onNavigateToIncident}
            onNavigateToFieldOps={(taskId) => {
              if (taskId) onSelectTask(taskId);
              setSubTab('field-ops');
            }}
            onRefresh={onRefresh}
          />
        )}

        {subTab === 'field-ops' && (
          <FieldOperationsPage
            defaultTab="verifications"
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onNavigateToIncident={onNavigateToIncident}
            onRefresh={onRefresh}
          />
        )}

        {subTab === 'analytics' && (
          <FieldOperationsPage defaultTab="analytics" onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
};
