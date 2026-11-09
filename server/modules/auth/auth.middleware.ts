import type { Request, RequestHandler } from 'express';
import type { Role, User } from '../../../shared/state.ts';
import { AppError } from '../../shared/errors.ts';
import type { AuthService } from './auth.service.ts';
declare module 'express-serve-static-core' {
  interface Locals {
    user: User;
  }
}
export function sessionToken(cookie?: string) {
  return (
    cookie
      ?.split(';')
      .map(s => s.trim())
      .find(s => s.startsWith('sismant_session='))
      ?.slice('sismant_session='.length) ?? ''
  );
}
export function assertSessionContext(req: Request, user: User) {
  if (
    req.headers['x-sismant-connection'] !== user.connectionId ||
    req.headers['x-sismant-user'] !== String(user.id)
  )
    throw new AppError(
      409,
      'La sesión cambió en otra pestaña. Recarga antes de continuar',
      'SESSION_CHANGED'
    );
}
export const authenticate =
  (auth: AuthService): RequestHandler =>
  async (req, res, next) => {
    const user = await auth.authenticate(sessionToken(req.headers.cookie));
    if (!user) throw new AppError(401, 'Inicia sesión para continuar');
    res.locals.user = user;
    next();
  };
export const authorize =
  (...roles: Role[]): RequestHandler =>
  (_req, res, next) => {
    if (!roles.includes(res.locals.user.role))
      throw new AppError(403, 'No tienes permiso para esta operación');
    next();
  };
