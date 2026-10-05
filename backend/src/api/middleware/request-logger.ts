import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logging/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, `${req.method} ${req.originalUrl} ${statusCode} - ${durationMs}ms`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode,
      durationMs,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
}
