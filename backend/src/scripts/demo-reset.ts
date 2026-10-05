import { CanonicalDemoService } from '../services/demo/canonical-demo-service.js';
import { logger } from '../logging/logger.js';
import { config } from '../config/index.js';

async function runDemoReset() {
  console.log('============================================================');
  console.log(' AquaSentinel — Deterministic Demo Reset (Phase 9)');
  console.log('============================================================\n');

  // 1. Try calling running API first if active
  const apiUrl = `http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}/api/v1/demo/reset`;
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('✓ Successfully reset running AquaSentinel backend via API');
      console.log(`  Current Stage:   Stage ${data.data?.currentStage} (${data.data?.stageName})`);
      console.log(`  Reach:           ${data.data?.reachName} (${data.data?.reachId})`);
      console.log('\n============================================================');
      console.log(' DEMO RESET COMPLETE (< 5 seconds)');
      console.log('============================================================\n');
      process.exit(0);
    }
  } catch (_err) {
    // API is not running locally; proceed to direct in-process reset
  }

  // 2. Direct In-Process Reset
  try {
    console.log('Backend server not detected on HTTP port. Executing direct in-process reset...');
    const result = await CanonicalDemoService.stage0_resetAndBaseline();
    console.log('✓ Successfully reset AquaSentinel repository state and demo lifecycle');
    console.log(`  Current Stage:   Stage ${result.currentStage} (${result.stageName})`);
    console.log(`  Reach:           ${result.reachName} (${result.reachId})`);
    console.log('\n============================================================');
    console.log(' DEMO RESET COMPLETE (< 5 seconds)');
    console.log('============================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('✗ Demo reset failed:', err.message);
    process.exit(1);
  }
}

runDemoReset();
