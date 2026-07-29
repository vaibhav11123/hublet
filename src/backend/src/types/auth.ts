export type UserRole = 'admin' | 'buyer' | 'seller';

export interface AuthenticatedUser {
  role: UserRole;
  email: string;
  userId?: string;
}

export interface JwtPayload extends AuthenticatedUser {
  iat?: number;
  exp?: number;
}
