/**
 * Demo Scenarios REST API Router
 * Supports executing deterministic Scenarios A through E (Phase 4 PRD Section 24 & 33).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { phase4DemoScenarios } from '../../domain/response/demo-scenarios.js';
import { getRepositories } from '../../database/repositories/index.js';
import { ValidationError } from '../middleware/error-handler.js';
import { getFhirAdapter } from '../../adapters/fhir/index.js';
import { getEventBus } from '../../events/index.js';
import { generateId, nowUtc } from '../../domain/value-objects.js';
import { Incident } from '@aquasentinel/shared';
import { getResilienceAnalyticsService } from '../../services/analytics/resilience-analytics-service.js';
import { Phase7DemoRunner } from '../../services/interoperability/demo-runner.js';
import { Phase8DemoRunner } from '../../domain/response/demo-scenarios-phase8.js';
import { CanonicalDemoService } from '../../services/demo/canonical-demo-service.js';
import { resetSystemState } from '../../database/reset.js';

export const demoRouter = Router();

// GET /api/v1/demo/canonical/status
demoRouter.get('/canonical/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await CanonicalDemoService.getStatus();
    res.json({
      success: true,
      data: status,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/canonical/step
demoRouter.post('/canonical/step', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepNumber = typeof req.body?.step === 'number' ? req.body.step : undefined;
    const status = await CanonicalDemoService.executeNextStep(stepNumber);
    res.json({
      success: true,
      data: status,
      message: `Advanced to stage ${status.currentStage}: ${status.stageName}`,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/canonical/run-to-gate
demoRouter.post('/canonical/run-to-gate', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await CanonicalDemoService.runToGate();
    res.json({
      success: true,
      data: status,
      message: 'Canonical scenario advanced to Stage 3: Human Decision Gate.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/canonical/approve
demoRouter.post('/canonical/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await CanonicalDemoService.stage4_approveRecommendation(req.body);
    res.json({
      success: true,
      data: status,
      message: 'Recommendation approved by supervisor; operational task created.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/canonical/reset
demoRouter.post('/canonical/reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await CanonicalDemoService.stage0_resetAndBaseline();
    res.json({
      success: true,
      data: status,
      message: 'Demo baseline reset to clean surveillance state.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/canonical/execute
// Canonical End-to-End Operational Lifecycle Demo
demoRouter.post('/canonical/execute', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await CanonicalDemoService.executeEndToEndScenario();
    res.json({
      success: true,
      data: result,
      message: 'Canonical end-to-end municipal operational lifecycle scenario executed successfully.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/scenarios/:scenarioId/execute
demoRouter.post('/scenarios/:scenarioId/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params.scenarioId.toUpperCase();
    const scenarioId = rawId.replace(/^SCENARIO_/, '');
    if (!['A', 'B', 'C', 'D', 'E'].includes(scenarioId)) {
      throw new ValidationError(`Unknown scenario '${req.params.scenarioId}'. Valid scenarios are A, B, C, D, E.`);
    }

    let result;
    if (scenarioId === 'A') result = phase4DemoScenarios.runScenarioA();
    else if (scenarioId === 'B') result = phase4DemoScenarios.runScenarioB();
    else if (scenarioId === 'C') result = phase4DemoScenarios.runScenarioC();
    else if (scenarioId === 'D') result = phase4DemoScenarios.runScenarioD();
    else result = phase4DemoScenarios.runScenarioE();

    // Persist into current repositories so frontend views reflect the scenario immediately
    const repos = getRepositories();
    const fhir = getFhirAdapter();

    // 1. Persist Reach & Observations
    await repos.streamReaches.create(result.streamReach).catch(() => {});
    for (const obs of result.observations) {
      await repos.observations.create(obs).catch(() => {});
    }

    // 2. Persist Evidence Assessment
    await repos.evidenceAssessments.save(result.assessment).catch(() => {});

    // 3. Persist Recommendations
    for (const rec of result.recommendations) {
      await repos.recommendations.create(rec).catch(() => {});
    }

    // 4. Persist Tasks & mirror to FHIR
    for (const task of result.tasks) {
      await repos.tasks.create(task).catch(() => {});
      fhir.publishTask(task).catch(() => {});
    }

    // 5. Persist Incident so Incident Queue, Map, and Dashboard reflect the scenario
    const incidentId = result.recommendations[0]?.incidentId || result.tasks[0]?.incidentId || generateId();
    const hazardType =
      result.classification.type === 'POSSIBLE_CYANOBLOOM'
        ? 'ALGAL_BLOOM'
        : result.classification.type === 'POSSIBLE_EUTROPHICATION'
        ? 'EUTROPHICATION'
        : result.classification.type === 'POSSIBLE_SEWAGE_CONTAMINATION'
        ? 'SEWAGE_OVERFLOW'
        : result.classification.type === 'POSSIBLE_INDUSTRIAL_DISCHARGE'
        ? 'CHEMICAL_SPILL'
        : 'UNKNOWN';

    const existingIncidents = await repos.incidents.findAll().catch(() => []);
    let incident: Incident | undefined = existingIncidents.find((i) => i.id === incidentId || i.streamReachId === result.streamReach.id);

    if (incident) {
      const updated = await repos.incidents.update(incident.id, {
        hazardType,
        evidenceConfidence: result.assessment.score,
        severity: result.severity.level === 'MODERATE' ? 'MEDIUM' : result.severity.level,
        status: result.assessment.confidenceBand === 'PRIORITIZE' ? 'ACTION_RECOMMENDED' : 'DETECTED',
      });
      if (updated) incident = updated;
    } else {
      incident = await repos.incidents.create({
        id: incidentId,
        streamReachId: result.streamReach.id,
        createdAt: nowUtc(),
        updatedAt: nowUtc(),
        status: result.assessment.confidenceBand === 'PRIORITIZE' ? 'ACTION_RECOMMENDED' : 'DETECTED',
        hazardType,
        evidenceConfidence: result.assessment.score,
        severity: result.severity.level === 'MODERATE' ? 'MEDIUM' : result.severity.level,
        verificationStatus: 'UNVERIFIED',
      }).catch(() => undefined);
    }

    // 6. Log audit trail events
    if (incident) {
      await repos.auditLogs.log({
        id: generateId(),
        incidentId: incident.id,
        eventType: 'INCIDENT_DETECTED',
        timestamp: nowUtc(),
        actor: 'system:demo_runner',
        reason: `Demo scenario ${scenarioId} executed: ${result.name}`,
        newStatus: incident.status,
      }).catch(() => {});
    }

    // 7. Emit real-time domain events to EventBus
    const eventBus = getEventBus();
    for (const obs of result.observations) {
      await eventBus.publish({
        eventId: generateId(),
        eventType: 'ObservationReceived',
        timestamp: nowUtc(),
        actor: 'system:demo_runner',
        payload: { observation: obs },
      }).catch(() => {});
    }

    await eventBus.publish({
      eventId: generateId(),
      eventType: 'EvidenceUpdated',
      timestamp: nowUtc(),
      actor: 'system:demo_runner',
      payload: {
        assessment: result.assessment,
        streamReachId: result.streamReach.id,
        incidentId: incident?.id,
      },
    }).catch(() => {});

    if (incident) {
      await eventBus.publish({
        eventId: generateId(),
        eventType: 'IncidentCreated',
        timestamp: nowUtc(),
        actor: 'system:demo_runner',
        payload: { incident },
      }).catch(() => {});
    }

    if (result.recommendations.length > 0) {
      await eventBus.publish({
        eventId: generateId(),
        eventType: 'RecommendationGenerated',
        timestamp: nowUtc(),
        actor: 'system:demo_runner',
        payload: {
          incidentId: incident?.id || incidentId,
          assessmentId: result.assessment.id,
          streamReachId: result.streamReach.id,
          recommendations: result.recommendations,
        },
      }).catch(() => {});
    }

    for (const task of result.tasks) {
      await eventBus.publish({
        eventId: generateId(),
        eventType: 'TaskCreated',
        timestamp: nowUtc(),
        actor: 'system:demo_runner',
        payload: { task },
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        scenarioId: req.params.scenarioId,
        name: result.name,
        description: result.description,
        evidenceScore: result.assessment.score,
        evidenceBand: result.assessment.confidenceBand,
        incidentType: result.classification.type,
        severityLevel: result.severity.level,
        recommendationsCount: result.recommendations.length,
        tasksCount: result.tasks.length,
        fhirTasksCount: result.fhirTasks.length,
        recommendations: result.recommendations,
        tasks: result.tasks,
        assessment: result.assessment,
        classification: result.classification,
        severity: result.severity,
      },
      message: `Scenario ${result.scenarioId} executed deterministically.`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase6/execute
demoRouter.post('/phase6/execute', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getResilienceAnalyticsService();
    const stats = await service.executeDemoScenarios();

    res.json({
      success: true,
      data: stats,
      message: 'Phase 6 deterministic demo scenarios executed and persisted successfully.',
      meta: {
        timestamp: nowUtc(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Phase 7: Event-Driven Interoperability Demonstrations (PRD Section 20, 39, 40, 41)

// POST /api/v1/demo/phase7/execute (Golden Path)
demoRouter.post('/phase7/execute', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase7DemoRunner.executeGoldenPath();
    res.json({
      success: true,
      data: result,
      message: result.summary,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase7/simulate-failure (Failure & Retry)
demoRouter.post('/phase7/simulate-failure', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase7DemoRunner.simulateFailureAndRecovery();
    res.json({
      success: true,
      data: result,
      message: result.summary,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase7/simulate-duplicate (Idempotency & Deduplication)
demoRouter.post('/phase7/simulate-duplicate', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase7DemoRunner.simulateDuplicateDelivery();
    res.json({
      success: true,
      data: result,
      message: result.summary,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase7/simulate-dead-letter (Dead-Letter & Replay)
demoRouter.post('/phase7/simulate-dead-letter', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase7DemoRunner.simulateDeadLetterAndReplay();
    res.json({
      success: true,
      data: result,
      message: result.summary,
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 8: Closed-Loop Field Response Demonstrations (PRD Section 33, 39, 40)
// ============================================================

// POST /api/v1/demo/phase8/scenario-a (Confirmed Contamination)
demoRouter.post('/phase8/scenario-a', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase8DemoRunner.runScenarioA_Confirmed();
    res.json({
      success: true,
      data: result,
      message: 'Phase 8 Scenario A (Confirmed Contamination) executed successfully.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase8/scenario-b (False Alarm / Not Confirmed)
demoRouter.post('/phase8/scenario-b', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase8DemoRunner.runScenarioB_NotConfirmed();
    res.json({
      success: true,
      data: result,
      message: 'Phase 8 Scenario B (False Alarm / Not Confirmed) executed successfully.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase8/scenario-c (Uncertain / Follow-Up Required)
demoRouter.post('/phase8/scenario-c', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase8DemoRunner.runScenarioC_Uncertain();
    res.json({
      success: true,
      data: result,
      message: 'Phase 8 Scenario C (Uncertain / Follow-Up Required) executed successfully.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/demo/phase8/execute-all (Run all Phase 8 scenarios)
demoRouter.post('/phase8/execute-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await Phase8DemoRunner.executeAll();
    res.json({
      success: true,
      data: result,
      message: 'All Phase 8 closed-loop field response demo scenarios executed successfully.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Phase 9: System Reset (PRD Section 24)
// ============================================================

// POST /api/v1/demo/reset
demoRouter.post('/reset', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await CanonicalDemoService.stage0_resetAndBaseline();
    res.json({
      success: true,
      data: status,
      message: 'System successfully reset to clean deterministic demo baseline.',
      meta: { timestamp: nowUtc() },
    });
  } catch (err) {
    next(err);
  }
});


