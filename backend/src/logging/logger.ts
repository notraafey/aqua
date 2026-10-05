import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, json, colorize, printf } = winston.format;

const devFormat = printf(({ level, message, timestamp, service, requestId, incidentId, ...metadata }) => {
  const reqStr = requestId ? ` [req:${requestId}]` : '';
  const incStr = incidentId ? ` [inc:${incidentId}]` : '';
  const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
  return `${timestamp} [${service}] ${level}:${reqStr}${incStr} ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  defaultMeta: { service: 'aquasentinel-backend' },
  format: combine(
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    config.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new winston.transports.Console()
  ],
});
