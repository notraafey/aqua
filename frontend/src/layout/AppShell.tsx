import React from 'react';
import { Header } from './Header.js';
import { Sidebar, NavTab } from './Sidebar.js';
import { HealthCheckResponse } from '@aquasentinel/shared';
import { DemoControlBar } from '../components/demo/DemoControlBar.js';

interface AppShellProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onNavigate?: (tab: NavTab, entityId?: string) => void;
  onRefreshData?: () => void;
  onResetState?: () => Promise<any> | void;
  health?: HealthCheckResponse | null;
  isLoadingHealth: boolean;
  waterNetworkSubTab?: 'map' | 'reaches';
  onSelectWaterNetworkSubTab?: (subTab: 'map' | 'reaches') => void;
  counts?: {
    reaches: number;
    assessments?: number;
    incidents: number;
    recommendations?: number;
    tasks: number;
  };
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onSelectTab,
  onNavigate,
  onRefreshData,
  onResetState,
  health,
  isLoadingHealth,
  waterNetworkSubTab = 'reaches',
  onSelectWaterNetworkSubTab,
  counts,
  children,
}) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f3f6fb] text-slate-800 antialiased font-sans">
      {/* Redesigned Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        waterNetworkSubTab={waterNetworkSubTab}
        onSelectWaterNetworkSubTab={onSelectWaterNetworkSubTab}
        counts={counts}
      />

      {/* Main Right Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Redesigned Top Header */}
        <Header
          health={health}
          isLoading={isLoadingHealth}
          onNavigate={onNavigate || onSelectTab}
          onRefreshData={onRefreshData}
          onResetState={onResetState}
          currentTab={currentTab}
        />

        {/* Dedicated Incident Lifecycle Controller */}
        <DemoControlBar
          onNavigate={onNavigate || onSelectTab}
          onRefreshData={onRefreshData}
          onResetState={onResetState}
        />

        {/* Zero-Scroll Single-Viewport Canvas */}
        <main className="flex-1 min-h-0 overflow-hidden px-4 py-2.5 flex flex-col">
          <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
