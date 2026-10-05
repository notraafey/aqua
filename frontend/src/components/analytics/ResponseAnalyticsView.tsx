import React, { useEffect, useState } from 'react';
import { Card } from '../common/Card.js';
import { Badge } from '../common/Badge.js';
import { Button } from '../common/Button.js';
import { LoadingSpinner } from '../common/LoadingSpinner.js';
import { apiClient } from '../../api/client.js';
import {
  MapPin,
  Clock,
  RefreshCw,
  ShieldCheck,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface ResponseAnalyticsData {
  summary: {
    totalTasks: number;
    verifiedTasks: number;
    pendingTasks: number;
    totalVerifications: number;
    totalOutcomes: number;
    confirmedCount: number;
    falseAlarmCount: number;
    falseAlarmRate: number;
    geofenceComplianceRate: number;
    avgResponseTimeHours: number;
  };
  outcomeBreakdown: Record<string, number>;
  actorMetrics: Array<{
    actorId: string;
    name: string;
    role: string;
    organization: string;
    active: boolean;
    tasksAssigned: number;
    verificationsSubmitted: number;
  }>;
  recentOutcomes: any[];
}

export const ResponseAnalyticsView: React.FC = () => {
  const [data, setData] = useState<ResponseAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getResponseAnalytics();
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load response analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80">
        <LoadingSpinner label="Loading response operations analytics..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm">
        <p className="font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Error loading response analytics
        </p>
        <p className="mt-1 text-rose-700 text-xs">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchAnalytics} className="mt-3">
          Retry Analytics Request
        </Button>
      </div>
    );
  }

  const s = data?.summary;
  const breakdown = data?.outcomeBreakdown || {};

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Performance & Compliance Telemetry
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-0.5">Response Operations Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time closed-loop field verification performance, geofence compliance, and triage latency
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchAnalytics} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Verifications</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{s?.totalVerifications || 0}</div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-700 font-semibold">{s?.verifiedTasks || 0}</span> tasks closed
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">False Alarm Rate</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {s?.falseAlarmRate !== undefined ? `${s.falseAlarmRate}%` : '0%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {s?.falseAlarmCount || 0} uncorroborated anomalies filtered
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Geofence Compliance</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200/80 flex items-center justify-center text-sky-600">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {s?.geofenceComplianceRate !== undefined ? `${s.geofenceComplianceRate}%` : '100%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Inspections within 250m threshold</div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Response Time</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {s?.avgResponseTimeHours ? `${s.avgResponseTimeHours}h` : '< 1h'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Task dispatch to ground verification</div>
        </div>
      </div>

      {/* Operational Outcomes Distribution */}
      <Card
        title="Operational Outcomes Distribution"
        subtitle="Distribution of decisions proposed by OutcomeEngine and confirmed by operators"
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{breakdown['CONFIRMED'] || 0}</div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-800 mt-1">Confirmed</div>
          </div>
          <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-sky-700">{breakdown['NOT_CONFIRMED'] || 0}</div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-800 mt-1">False Alarms</div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-amber-700">
              {breakdown['ADDITIONAL_VERIFICATION_REQUIRED'] || 0}
            </div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 mt-1">Follow-Up Req.</div>
          </div>
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-rose-700">{breakdown['ESCALATE'] || 0}</div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-rose-800 mt-1">Escalated</div>
          </div>
          <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-center">
            <div className="text-xl font-bold text-purple-700">{breakdown['UNCERTAIN'] || 0}</div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-purple-800 mt-1">Uncertain</div>
          </div>
        </div>
      </Card>

      {/* Field Actor Workload & Readiness */}
      <Card
        title="Field Force Readiness & Assignment Distribution"
        subtitle="Registered inspectors, municipal officers, and environmental specialists"
      >
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="pb-3 font-semibold">Actor</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Organization</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-center">Assigned Tasks</th>
                <th className="pb-3 font-semibold text-center">Completed Verifications</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.actorMetrics || []).map((actor) => (
                <tr key={actor.actorId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-xs text-blue-700 font-bold">
                      {actor.name.charAt(0)}
                    </div>
                    {actor.name}
                  </td>
                  <td className="py-3 text-slate-600 text-xs">
                    <Badge variant="slate" size="sm">
                      {actor.role.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 text-slate-600 text-xs">{actor.organization}</td>
                  <td className="py-3 text-center">
                    <Badge variant={actor.active ? 'emerald' : 'slate'} size="sm">
                      {actor.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 text-center font-mono text-slate-700 font-medium">{actor.tasksAssigned}</td>
                  <td className="py-3 text-center font-mono text-blue-600 font-bold">
                    {actor.verificationsSubmitted}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
