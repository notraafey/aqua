import { CanonicalDemoService } from '../services/demo/canonical-demo-service.js';
import { config } from '../config/index.js';
import { isDatabaseHealthy } from '../database/client.js';
import { createRepositories, setRepositories } from '../database/repositories/index.js';
import { seedBaselineData } from '../database/seed.js';
import { evidenceFusionService } from '../services/evidence/evidence-fusion-service.js';
import { getOperationalResponseService } from '../services/response/operational-response-service.js';
import { getInteroperabilityService } from '../services/interoperability/interoperability-service.js';

async function ensureLocalEnvironment() {
  const dbHealth = await isDatabaseHealthy();
  if (!dbHealth.healthy) {
    const inMemoryContainer = createRepositories(true);
    setRepositories(inMemoryContainer);
    await seedBaselineData();
  }
  evidenceFusionService.initialize();
  getOperationalResponseService().initialize();
  getInteroperabilityService().initialize();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--status';

  const host = config.HOST === '0.0.0.0' ? 'localhost' : config.HOST;
  const baseUrl = `http://${host}:${config.PORT}/api/v1/demo/canonical`;

  // Helper to call running API or fallback to in-process service
  async function callApi(path: string, method: string = 'POST', body?: any) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Backend not running on HTTP, fall back to in-process service
    }
    return null;
  }

  console.log('============================================================');
  console.log('  AquaSentinel — Canonical Demonstration Engine CLI');
  console.log('============================================================\n');

  if (command === '--reset' || command === 'reset') {
    const apiRes = await callApi('/reset');
    if (apiRes) {
      console.log('✓ Reset executed via active API:');
      console.log(apiRes.data);
    } else {
      await ensureLocalEnvironment();
      console.log('Executing in-process reset...');
      const res = await CanonicalDemoService.stage0_resetAndBaseline();
      console.log('✓ Direct in-process reset complete:');
      console.log(res);
    }
  } else if (command === '--gate' || command === 'gate') {
    console.log('Running stages 0 -> 3 up to the Human Review Decision Gate...');
    const apiRes = await callApi('/run-to-gate');
    if (apiRes) {
      console.log('✓ Stages 0-3 executed via active API:');
      console.log(`  Stage: ${apiRes.data.currentStage ?? apiRes.data.stage} (${apiRes.data.stageName})`);
      console.log(`  Incident: ${apiRes.data.incidentId}`);
      console.log(`  Confidence Score: ${apiRes.data.confidenceScore}% (${apiRes.data.confidenceBand})`);
      console.log(`  Recommendation: ${apiRes.data.recommendationId} [${apiRes.data.recommendationStatus}]`);
      console.log(`  Presenter Hint: ${apiRes.data.narrativeHint}`);
    } else {
      await ensureLocalEnvironment();
      const res = await CanonicalDemoService.runToGate();
      console.log('✓ Stages 0-3 executed in-process:');
      console.log(`  Stage: ${res.currentStage} (${res.stageName})`);
      console.log(`  Incident: ${res.incidentId}`);
      console.log(`  Confidence Score: ${res.confidenceScore}% (${res.confidenceBand})`);
      console.log(`  Recommendation: ${res.recommendationId} [${res.recommendationStatus}]`);
      console.log(`  Presenter Hint: ${res.narrativeHint}`);
    }
  } else if (command === '--approve' || command === 'approve') {
    console.log('Executing Human Decision Gate Approval (Stages 3 -> 4)...');
    const apiRes = await callApi('/approve', 'POST', {
      rationale: 'CLI Operator: Field dispatch approved per rapid chlorophyll & hypoxia corroboration protocol.',
      priority: 'HIGH',
    });
    if (apiRes) {
      console.log('✓ Human approval recorded via active API:');
      console.log(apiRes.data);
    } else {
      await ensureLocalEnvironment();
      const status = await CanonicalDemoService.getStatus();
      if (!status.recommendationId) {
        console.error('✗ No recommendation pending review. Run --gate first.');
        process.exit(1);
      }
      const res = await CanonicalDemoService.stage4_approveRecommendation({
        actor: 'Chief Inspector Maria Papadopoulou',
        notes: 'CLI Operator: Field dispatch approved.',
      });
      console.log('✓ Human approval recorded in-process:');
      console.log(res);
    }
  } else if (command.startsWith('--step=') || command === 'step') {
    const stepNum = command.startsWith('--step=') ? parseInt(command.split('=')[1], 10) : parseInt(args[1] || '1', 10);
    console.log(`Advancing to Step ${stepNum}...`);
    const apiRes = await callApi('/step', 'POST', { step: stepNum });
    if (apiRes) {
      console.log(`✓ Step ${stepNum} executed via active API:`);
      console.log(apiRes.data);
    } else {
      await ensureLocalEnvironment();
      const res = await CanonicalDemoService.executeNextStep(stepNum);
      console.log(`✓ Step ${stepNum} executed in-process:`);
      console.log(res);
    }
  } else if (command === '--full' || command === 'full') {
    console.log('Running complete 0 -> 8 end-to-end lifecycle...');
    const apiRes = await callApi('/execute');
    if (apiRes) {
      console.log('✓ Full demonstration pipeline executed via active API:');
      console.log(apiRes.data);
    } else {
      await ensureLocalEnvironment();
      const res = await CanonicalDemoService.executeEndToEndScenario();
      console.log('✓ Full demonstration pipeline executed in-process:');
      console.log(res);
    }
  } else {
    // Status
    const apiRes = await callApi('/status', 'GET');
    if (apiRes) {
      console.log('Current Active Demonstration State (from HTTP API):');
      console.table(apiRes.data);
    } else {
      await ensureLocalEnvironment();
      const status = await CanonicalDemoService.getStatus();
      console.log('Current In-Process Demonstration State:');
      console.table(status);
    }
  }

  console.log('\n============================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
