import React, { useState } from 'react';
import { ReachResilienceScorecard, EarlyWarning } from '@aquasentinel/shared';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Search, ChevronRight, Compass } from 'lucide-react';

interface ResilienceOverviewProps {
  scorecards: ReachResilienceScorecard[];
  activeEarlyWarnings: EarlyWarning[];
  onSelectReach: (reachId: string) => void;
  systemSummary?: {
    totalReachesMonitored: number;
    reachesWithEarlyWarnings: number;
    averageObservationFrequencyDays: number;
    bestPerformingModel: string;
  };
}

export const ResilienceOverview: React.FC<ResilienceOverviewProps> = ({
  scorecards,
  activeEarlyWarnings,
  onSelectReach,
  systemSummary,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stabilityFilter, setStabilityFilter] = useState<string>('ALL');
  const [warningFilter, setWarningFilter] = useState<boolean>(false);

  const filteredScorecards = scorecards.filter((sc) => {
    const matchesSearch = sc.reachName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStability = stabilityFilter === 'ALL' || sc.environmentalStability === stabilityFilter;
    const matchesWarning = !warningFilter || sc.activeEarlyWarningsCount > 0;
    return matchesSearch && matchesStability && matchesWarning;
  });

  const getStabilityBadge = (rating: ReachResilienceScorecard['environmentalStability']) => {
    switch (rating) {
      case 'DETERIORATING':
        return <Badge variant="rose">DETERIORATING</Badge>;
      case 'VOLATILE':
        return <Badge variant="amber">VOLATILE</Badge>;
      case 'MODERATE':
        return <Badge variant="cyan">MODERATE</Badge>;
      case 'STABLE':
      default:
        return <Badge variant="emerald">STABLE</Badge>;
    }
  };

  const getCoverageBadge = (rating: ReachResilienceScorecard['monitoringCoverage']) => {
    switch (rating) {
      case 'HIGH':
        return <Badge variant="emerald" size="sm">HIGH</Badge>;
      case 'MODERATE':
        return <Badge variant="cyan" size="sm">MODERATE</Badge>;
      case 'LOW':
        return <Badge variant="amber" size="sm">LOW</Badge>;
      case 'POOR':
      default:
        return <Badge variant="rose" size="sm">POOR</Badge>;
    }
  };

  const getReadinessBadge = (rating: ReachResilienceScorecard['responseReadiness']) => {
    switch (rating) {
      case 'HIGH':
        return <Badge variant="emerald" size="sm">READY</Badge>;
      case 'MODERATE':
        return <Badge variant="cyan" size="sm">MODERATE</Badge>;
      case 'LOW':
      default:
        return <Badge variant="amber" size="sm">CONSTRAINED</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* System Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Monitored Reaches
          </span>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
            {systemSummary?.totalReachesMonitored ?? scorecards.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Volos catchment streams</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Active Early Warnings
          </span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {activeEarlyWarnings.length}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Across {systemSummary?.reachesWithEarlyWarnings ?? 0} reaches
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Deteriorating Reaches
          </span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
            {scorecards.filter((s) => s.environmentalStability === 'DETERIORATING').length}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Requiring prioritized inspection</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Optimal Forecast Model
          </span>
          <div className="text-lg font-bold font-mono text-cyan-400 mt-1 truncate" title={systemSummary?.bestPerformingModel}>
            {systemSummary?.bestPerformingModel ?? 'linear-trend-v1'}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Lowest RMSE in backtest</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search reaches by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={stabilityFilter}
            onChange={(e) => setStabilityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Stability Ratings</option>
            <option value="DETERIORATING">Deteriorating</option>
            <option value="VOLATILE">Volatile</option>
            <option value="MODERATE">Moderate</option>
            <option value="STABLE">Stable</option>
          </select>

          <button
            onClick={() => setWarningFilter(!warningFilter)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              warningFilter
                ? 'bg-amber-950/80 border-amber-800/80 text-amber-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {warningFilter ? 'Active Warnings Only (On)' : 'Filter by Warnings'}
          </button>
        </div>
      </div>

      {/* Multidimensional Scorecards Table */}
      <div className="border border-slate-800 rounded-xl bg-slate-950/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3.5">Stream Reach</th>
                <th className="p-3.5">Environmental Stability</th>
                <th className="p-3.5">Evidence Coverage</th>
                <th className="p-3.5">Monitoring Coverage</th>
                <th className="p-3.5">Response Readiness</th>
                <th className="p-3.5">Current Trend</th>
                <th className="p-3.5 text-right">Latest NDCI</th>
                <th className="p-3.5 text-center">Warnings</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredScorecards.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    No reaches match the active filters.
                  </td>
                </tr>
              ) : (
                filteredScorecards.map((sc) => (
                  <tr
                    key={sc.reachId}
                    onClick={() => onSelectReach(sc.reachId)}
                    className="hover:bg-slate-900/50 cursor-pointer transition-colors group"
                  >
                    <td className="p-3.5 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        <Compass size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                        <div>
                          <span className="font-semibold block">{sc.reachName}</span>
                          <span className="text-[10px] font-mono text-slate-500">{sc.reachId.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {getStabilityBadge(sc.environmentalStability)}
                    </td>
                    <td className="p-3.5">
                      <Badge variant={sc.evidenceCoverage === 'HIGH' ? 'emerald' : sc.evidenceCoverage === 'MODERATE' ? 'cyan' : 'amber'} size="sm">
                        {sc.evidenceCoverage}
                      </Badge>
                    </td>
                    <td className="p-3.5">
                      {getCoverageBadge(sc.monitoringCoverage)}
                    </td>
                    <td className="p-3.5">
                      {getReadinessBadge(sc.responseReadiness)}
                    </td>
                    <td className="p-3.5 font-mono text-[11px]">
                      <span className={sc.currentTrend === 'ACCELERATING' ? 'text-rose-400 font-bold' : sc.currentTrend === 'INCREASING' ? 'text-amber-400' : 'text-slate-400'}>
                        {sc.currentTrend}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-slate-200">
                      <span className="font-bold">{sc.latestNdci !== undefined ? sc.latestNdci.toFixed(3) : '—'}</span>
                      {sc.baselineNdci && (
                        <span className="text-[10px] text-slate-500 block">
                          Base: {sc.baselineNdci.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {sc.activeEarlyWarningsCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-950 border border-amber-800 text-amber-400">
                          {sc.activeEarlyWarningsCount}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono">0</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReach(sc.reachId);
                        }}
                      >
                        Inspect
                        <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
