import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/auth';
import { verifyAuthToken } from '../utils/jwt';

export function authenticateJwt(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const payload = verifyAuthToken(token);

    req.user = {
      role: payload.role,
      email: payload.email,
      userId: payload.userId,
    };

    next();
  } catch (error: any) {
    return res.status(401).json({ error: error.message || 'Invalid or expired token' });
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }

    next();
  };
}
