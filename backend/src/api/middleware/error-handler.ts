import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, ApiErrorDetail } from '@aquasentinel/shared';
import { logger } from '../../logging/logger.js';
import { config } from '../../config/index.js';
import { nowUtc } from '../../domain/value-objects.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: ApiErrorDetail[]) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ExternalDependencyError extends AppError {
  constructor(message: string, details?: ApiErrorDetail[]) {
    super(message, 502, 'EXTERNAL_DEPENDENCY_ERROR', details);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const details = err instanceof AppError ? err.details : undefined;

  logger.error(`[API Error] ${req.method} ${req.originalUrl} - ${err.message}`, {
    requestId,
    statusCode,
    code,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: statusCode === 500 && config.NODE_ENV === 'production'
        ? 'An unexpected internal error occurred.'
        : err.message,
      details,
      requestId,
      timestamp: nowUtc(),
    },
  };

  res.status(statusCode).json(response);
}
