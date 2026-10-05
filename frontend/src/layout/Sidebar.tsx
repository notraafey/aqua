import React from 'react';
import {
  LayoutDashboard,
  Split,
  FileText,
  AlertCircle,
  Settings,
  Compass,
  Share2,
  ShieldCheck,
  Droplet,
} from 'lucide-react';
import { clsx } from 'clsx';

export type CanonicalTab =
  | 'command-center'
  | 'water-network'
  | 'monitoring-evidence'
  | 'incidents'
  | 'response-operations'
  | 'resilience'
  | 'interoperability'
  | 'system-health';

export type LegacyTab =
  | 'dashboard'
  | 'reaches'
  | 'map'
  | 'evidence'
  | 'recommendations'
  | 'tasks'
  | 'field-ops'
  | 'health';

export type NavTab = CanonicalTab | LegacyTab;

export function toCanonicalTab(tab: NavTab): CanonicalTab {
  switch (tab) {
    case 'dashboard':
    case 'command-center':
      return 'command-center';
    case 'reaches':
    case 'map':
    case 'water-network':
      return 'water-network';
    case 'evidence':
    case 'monitoring-evidence':
      return 'monitoring-evidence';
    case 'incidents':
      return 'incidents';
    case 'recommendations':
    case 'tasks':
    case 'field-ops':
    case 'response-operations':
      return 'response-operations';
    case 'resilience':
      return 'resilience';
    case 'interoperability':
      return 'interoperability';
    case 'health':
    case 'system-health':
      return 'system-health';
    default:
      return 'command-center';
  }
}

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  waterNetworkSubTab?: 'map' | 'reaches';
  onSelectWaterNetworkSubTab?: (subTab: 'map' | 'reaches') => void;
  counts?: {
    reaches: number;
    assessments?: number;
    incidents: number;
    recommendations?: number;
    tasks: number;
    earlyWarnings?: number;
    outboxPending?: number;
    fieldOps?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  waterNetworkSubTab = 'reaches',
  onSelectWaterNetworkSubTab,
  counts,
}) => {
  const activeCanonical = toCanonicalTab(currentTab);

  const navItems = [
    { id: 'command-center' as NavTab, label: 'Overview', icon: LayoutDashboard },
    {
      id: 'water-network' as NavTab,
      label: 'Water Network',
      icon: Split,
      count: counts?.reaches,
      subItems: [
        { id: 'reaches' as const, label: 'Stream Reaches' },
        { id: 'map' as const, label: 'Catchment Map' },
      ],
    },
    { id: 'monitoring-evidence' as NavTab, label: 'Evidence', icon: FileText, count: counts?.assessments },
    { id: 'incidents' as NavTab, label: 'Incidents', icon: AlertCircle, count: counts?.incidents },
    {
      id: 'response-operations' as NavTab,
      label: 'Operations',
      icon: Settings,
      count: ((counts?.recommendations || 0) + (counts?.tasks || 0)) || undefined,
    },
    { id: 'resilience' as NavTab, label: 'Resilience', icon: Compass, count: counts?.earlyWarnings },
    { id: 'interoperability' as NavTab, label: 'Interoperability', icon: Share2, count: counts?.outboxPending },
    { id: 'system-health' as NavTab, label: 'System Health', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 p-5 flex flex-col justify-between shrink-0 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)] z-30">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-1 py-1">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-sm">
            <Droplet size={20} className="fill-blue-600/20 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
              AquaSentinel
            </h1>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Safer Water, Stronger Communities.
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeCanonical === toCanonicalTab(item.id);
            const isWaterNetwork = item.id === 'water-network';

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => onSelectTab(item.id)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-blue-50/80 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      size={18}
                      className={clsx(
                        'transition-colors',
                        isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-mono font-medium',
                        isActive ? 'bg-blue-200/60 text-blue-800' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </button>

                {/* Sub-navigation for Water Network (as in aqua2 and aqua3) */}
                {isWaterNetwork && isActive && (
                  <div className="ml-7 pl-3 border-l-2 border-slate-200/80 space-y-1 py-1">
                    {item.subItems?.map((sub) => {
                      const isSubActive =
                        (sub.id === 'map' && waterNetworkSubTab === 'map') ||
                        (sub.id === 'reaches' && waterNetworkSubTab === 'reaches');

                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            onSelectTab('water-network');
                            onSelectWaterNetworkSubTab?.(sub.id);
                          }}
                          className={clsx(
                            'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                            isSubActive
                              ? 'text-blue-700 bg-blue-50/60 font-semibold'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                          )}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Card (Clean water. Healthier tomorrows.) */}
      <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50/40 border border-blue-100/90 shadow-sm">
        {/* Subtle Water Shimmer */}
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-200/20 rounded-full blur-xl pointer-events-none" />
        <h4 className="text-sm font-bold text-slate-900 leading-snug">
          Clean water.<br />Healthier tomorrows.
        </h4>
        <div className="w-8 h-0.5 bg-slate-300 my-2.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed font-normal">
          A more resilient community, together.
        </p>
      </div>
    </aside>
  );
};
