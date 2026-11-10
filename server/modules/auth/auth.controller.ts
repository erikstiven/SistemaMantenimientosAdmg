import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Config } from '../../config.ts';
import { assertSessionContext, sessionToken } from './auth.middleware.ts';
import { AuthService } from './auth.service.ts';
const loginSchema = z
  .object({
    connectionId: z.string().regex(/^[a-z0-9_-]{1,50}$/),
    username: z.string().trim().min(1).max(100),
    password: z.string().min(1).max(256),
  })
  .strict();
export function authController(auth: AuthService, config: Config) {
  const cookie = {
    httpOnly: true,
    secure: config.APP_ORIGIN.startsWith('https://'),
    sameSite: 'strict' as const,
    path: '/api/v1',
    maxAge: config.SESSION_HOURS * 3600000,
  };
  const login: RequestHandler = async (req, res) => {
    const body = loginSchema.parse(req.body);
    const result = await auth.login(body.connectionId, body.username, body.password);
    res.cookie('sismant_session', result.token, cookie).json(result.user);
  };
  const logout: RequestHandler = async (req, res) => {
    const user = await auth.authenticate(sessionToken(req.headers.cookie));
    if (user) assertSessionContext(req, user);
    await auth.logout(sessionToken(req.headers.cookie));
    res
      .clearCookie('sismant_session', { ...cookie, maxAge: undefined })
      .status(204)
      .end();
  };
  const me: RequestHandler = (_req, res) => {
    res.json(res.locals.user);
  };
  const connections: RequestHandler = (_req, res) => {
    res.json(auth.connections());
  };
  return { login, logout, me, connections };
}
