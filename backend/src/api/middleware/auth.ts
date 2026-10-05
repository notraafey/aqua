import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './error-handler.js';

export type UserRole = 'admin' | 'decision_maker' | 'scientist' | 'field_inspector' | 'citizen';

export interface AuthContext {
  userId: string;
  role: UserRole;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Prototype header-based authentication
  const role = (req.headers['x-user-role'] as UserRole) || 'decision_maker';
  const userId = (req.headers['x-user-id'] as string) || 'system-default-user';

  (req as any).auth = {
    userId,
    role,
  };

  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth: AuthContext = (req as any).auth;
    if (!auth || !allowedRoles.includes(auth.role)) {
      throw new ForbiddenError(`Action requires one of the following roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}
