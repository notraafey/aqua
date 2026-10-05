import React, { useState } from 'react';
import {
  Search,
  Sun,
  ChevronDown,
  RefreshCw,
  Play,
  RotateCcw,
} from 'lucide-react';
import { HealthCheckResponse } from '@aquasentinel/shared';
import { apiClient } from '../api/client.js';
import { NavTab } from './Sidebar.js';
import { NotificationCenter } from '../components/notifications/NotificationCenter.js';

interface HeaderProps {
  health?: HealthCheckResponse | null;
  isLoading: boolean;
  onNavigate?: (tab: NavTab, entityId?: string) => void;
  onRefreshData?: () => void;
  onResetState?: () => Promise<any> | void;
  currentTab?: NavTab;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health: _health,
  isLoading,
  onNavigate,
  onRefreshData,
  onResetState,
  currentTab: _currentTab = 'command-center',
  searchPlaceholder = 'Search reaches, incidents, evidence...',
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatchment] = useState('Basin Command');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isRunningScenario, setIsRunningScenario] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const handleRunCanonical = async () => {
    setIsRunningScenario(true);
    setShowUserMenu(false);
    try {
      await apiClient.executeCanonicalDemo();
      onRefreshData?.();
    } catch (err) {
      console.error('Scenario execution failed:', err);
    } finally {
      setIsRunningScenario(false);
    }
  };

  const handleResetDemo = async () => {
    setShowUserMenu(false);
    try {
      if (onResetState) {
        await onResetState();
      } else {
        await apiClient.resetCanonicalDemo();
        onRefreshData?.();
      }
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  return (
    <header className="h-11 px-4 flex items-center justify-between border-b border-slate-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20 select-none shrink-0">
      {/* Search Input Bar (rounded-full pill) */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-blue-400 rounded-full pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 outline-none transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Right Controls: Catchment Selector, Sun/Weather, Notifications, User Avatar */}
      <div className="flex items-center gap-3">
        {/* Catchment Dropdown Selector */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50/80 hover:bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-full cursor-pointer transition-colors">
          <Sun size={13} className="text-amber-500" />
          <span>{selectedCatchment}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </div>

        {/* Live Refresh / Demo Actions Quick Trigger */}
        <button
          onClick={onRefreshData}
          disabled={isLoading}
          title="Live Data Refresh"
          className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
        </button>

        {/* Real-time Notification Center */}
        <NotificationCenter onNavigate={onNavigate} />

        {/* User Profile Chip (Jordan Diaz, Operations) */}
        <div className="relative">
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-2 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
              JD
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-xs font-bold text-slate-800">Jordan Diaz</div>
              <div className="text-[10px] text-slate-400 font-medium">Operations Command</div>
            </div>
            <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-700" />
          </div>

          {/* User & Demo Scenario Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-900">Jordan Diaz</p>
                <p className="text-[11px] text-slate-400">jordan.diaz@aquasentinel.io</p>
              </div>
              <div className="py-1">
                <button
                  onClick={handleRunCanonical}
                  disabled={isRunningScenario}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <Play size={13} className="text-blue-600" />
                  <span>Run Lifecycle Scenario</span>
                </button>
                <button
                  onClick={handleResetDemo}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <RotateCcw size={13} className="text-amber-600" />
                  <span>Reset Demo State</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
