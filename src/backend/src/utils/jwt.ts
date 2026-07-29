import jwt from 'jsonwebtoken';
import { AuthenticatedUser, JwtPayload } from '../types/auth';

function getSecret(): string {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  return JWT_SECRET;
}

export function signAuthToken(user: AuthenticatedUser): string {
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPRESS_IN || '24h';
  return jwt.sign(user, getSecret(), {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
