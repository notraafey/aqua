import { createConsumerApp } from './server.js';

const PORT = parseInt(process.env.CONSUMER_PORT || process.env.PORT || '3002', 10);
const HOST = process.env.HOST || '0.0.0.0';

const app = createConsumerApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[Volos Public Health Portal] Standalone consumer running on http://${HOST}:${PORT}`);
  console.log(`[Volos Public Health Portal] Health check: http://${HOST}:${PORT}/health`);
  console.log(`[Volos Public Health Portal] Webhook endpoint: http://${HOST}:${PORT}/webhook/fhir`);
});

process.on('SIGTERM', () => {
  console.log('[Volos Public Health Portal] Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Volos Public Health Portal] Interrupted. Shutting down...');
  server.close(() => process.exit(0));
});
