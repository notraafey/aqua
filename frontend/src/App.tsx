import React, { useState, useEffect, useCallback } from 'react';
import {
  HealthCheckResponse,
  StreamReach,
  Observation,
  Incident,
  Task,
  EvidenceAssessment,
  Recommendation,
} from '@aquasentinel/shared';
import { AppShell } from './layout/AppShell.js';
import { NavTab, toCanonicalTab } from './layout/Sidebar.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { WaterNetworkPage } from './pages/WaterNetworkPage.js';
import { IncidentsPage } from './pages/IncidentsPage.js';
import { EvidenceAssessmentsPage } from './pages/EvidenceAssessmentsPage.js';
import { ResponseOperationsPage, ResponseOperationsSubTab } from './pages/ResponseOperationsPage.js';
import { ResiliencePage } from './pages/ResiliencePage.js';
import { InteroperabilityPage } from './pages/InteroperabilityPage.js';
import { SystemHealthPage } from './pages/SystemHealthPage.js';
import { apiClient } from './api/client.js';
import { realtimeService } from './services/realtime.js';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('command-center');
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [reaches, setReaches] = useState<StreamReach[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assessments, setAssessments] = useState<EvidenceAssessment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [unackWarningsCount, setUnackWarningsCount] = useState<number>(0);

  // Sub-tab states for integrated pillars
  const [waterNetworkSubTab, setWaterNetworkSubTab] = useState<'map' | 'reaches'>('map');
  const [responseOpsSubTab, setResponseOpsSubTab] = useState<ResponseOperationsSubTab>('recommendations');

  // Selection state for deep linking / notification clicks
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedReachId, setSelectedReachId] = useState<string | null>('7a3b4c12-89de-4f56-9abc-1234567890ab');

  const fetchAllData = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const [h, r, o, i, t, a, recs, warnings] = await Promise.all([
        apiClient.getHealth().catch(() => null),
        apiClient.getStreamReaches().catch(() => []),
        apiClient.getObservations({ limit: 50 }).catch(() => []),
        apiClient.getIncidents().catch(() => []),
        apiClient.getTasks().catch(() => []),
        apiClient.getEvidenceAssessments().catch(() => []),
        apiClient.getRecommendations().catch(() => []),
        apiClient.getEarlyWarnings({ acknowledged: false }).catch(() => []),
      ]);

      setHealth(h);
      setReaches(Array.isArray(r) ? r : []);
      setObservations(Array.isArray(o) ? o : []);
      setIncidents(Array.isArray(i) ? i : []);
      setTasks(Array.isArray(t) ? t : []);
      setAssessments(Array.isArray(a) ? a : []);
      setRecommendations(Array.isArray(recs) ? recs : []);
      setUnackWarningsCount(Array.isArray(warnings) ? warnings.length : 0);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 15000);

    // Connect to real-time SSE stream
    realtimeService.connect();
    const unsubscribe = realtimeService.subscribe('*', () => {
      // Re-fetch data on any real-time domain event (new incident, task transition, etc.)
      fetchAllData();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fetchAllData]);

  const handleNavigate = useCallback((tab: NavTab, entityId?: string) => {
    if (tab === 'tasks') {
      setResponseOpsSubTab('tasks');
      setSelectedTaskId(entityId || null);
    } else if (tab === 'recommendations') {
      setResponseOpsSubTab('recommendations');
    } else if (tab === 'field-ops') {
      setResponseOpsSubTab('field-ops');
    } else if (tab === 'map') {
      setWaterNetworkSubTab('map');
    } else if (tab === 'reaches') {
      setWaterNetworkSubTab('reaches');
    } else if (tab === 'incidents') {
      setSelectedIncidentId(entityId || null);
    } else if (tab === 'evidence' || tab === 'monitoring-evidence') {
      if (entityId) setSelectedReachId(entityId);
    } else if (tab === 'resilience' && entityId) {
      setSelectedReachId(entityId);
    }

    const canonical = toCanonicalTab(tab);
    setCurrentTab(canonical);
  }, []);

  const handleResetDemoState = useCallback(async () => {
    try {
      const res = await apiClient.resetCanonicalDemo();
      setSelectedIncidentId(null);
      setSelectedTaskId(null);
      setSelectedReachId('7a3b4c12-89de-4f56-9abc-1234567890ab');
      setWaterNetworkSubTab('reaches');
      setCurrentTab('water-network');
      await fetchAllData();
      window.dispatchEvent(new CustomEvent('aquasentinel:reset-state', { detail: res }));
      return res;
    } catch (err) {
      console.error('Reset failed:', err);
      throw err;
    }
  }, [fetchAllData]);

  const counts = {
    reaches: reaches.length,
    assessments: assessments.length,
    incidents: incidents.length,
    recommendations: recommendations.filter((r) => r.status === 'PENDING_REVIEW').length,
    tasks: tasks.length,
    earlyWarnings: unackWarningsCount,
  };

  const canonicalTab = toCanonicalTab(currentTab);

  return (
    <ErrorBoundary>
      <AppShell
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onNavigate={handleNavigate}
        onRefreshData={fetchAllData}
        onResetState={handleResetDemoState}
        health={health}
        isLoadingHealth={isLoadingHealth}
        waterNetworkSubTab={waterNetworkSubTab}
        onSelectWaterNetworkSubTab={(sub) => {
          setWaterNetworkSubTab(sub);
          setCurrentTab('water-network');
        }}
        counts={counts}
      >
        {canonicalTab === 'command-center' && (
          <DashboardPage
            reaches={reaches}
            observations={observations}
            incidents={incidents}
            tasks={tasks}
            health={health}
            onRefresh={fetchAllData}
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
            onNavigateToTask={(id) => handleNavigate('tasks', id)}
            onNavigateToRecommendations={() => handleNavigate('recommendations')}
            onNavigateToWaterNetwork={() => handleNavigate('water-network')}
            onNavigateToSystemHealth={() => handleNavigate('system-health')}
          />
        )}

        {canonicalTab === 'water-network' && (
          <WaterNetworkPage
            reaches={reaches}
            incidents={incidents}
            tasks={tasks}
            observations={observations}
            initialSubTab={waterNetworkSubTab}
            onSubTabChange={(sub) => setWaterNetworkSubTab(sub)}
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
            onNavigateToTask={(id) => handleNavigate('tasks', id)}
            onNavigateToEvidence={(reachId) => handleNavigate('monitoring-evidence', reachId)}
            onNavigateToResilience={(reachId) => handleNavigate('resilience', reachId)}
          />
        )}

        {canonicalTab === 'monitoring-evidence' && (
          <EvidenceAssessmentsPage
            reaches={reaches}
            assessments={assessments}
            incidents={incidents}
            selectedReachId={selectedReachId}
            onRefresh={fetchAllData}
            onNavigateToRecommendations={() => handleNavigate('recommendations')}
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
          />
        )}

        {canonicalTab === 'incidents' && (
          <IncidentsPage
            incidents={incidents}
            reaches={reaches}
            selectedIncidentId={selectedIncidentId}
            onSelectIncident={setSelectedIncidentId}
            onNavigateToTask={(id) => handleNavigate('tasks', id)}
            onNavigateToEvidence={(reachId) => handleNavigate('evidence', reachId)}
            onNavigateToRecommendations={(id) => handleNavigate('recommendations', id)}
            onRefresh={fetchAllData}
          />
        )}

        {canonicalTab === 'response-operations' && (
          <ResponseOperationsPage
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
            onRefresh={fetchAllData}
            initialSubTab={responseOpsSubTab}
          />
        )}

        {canonicalTab === 'resilience' && (
          <ResiliencePage
            initialReachId={selectedReachId || undefined}
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
          />
        )}

        {canonicalTab === 'interoperability' && (
          <InteroperabilityPage
            onNavigateToIncident={(id) => handleNavigate('incidents', id)}
          />
        )}

        {canonicalTab === 'system-health' && (
          <SystemHealthPage
            health={health}
            isLoading={isLoadingHealth}
            onRefresh={fetchAllData}
          />
        )}
      </AppShell>
    </ErrorBoundary>
  );
};
