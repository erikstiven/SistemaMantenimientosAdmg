import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Config } from '../../config.ts';
import { authController } from './auth.controller.ts';
import { authenticate } from './auth.middleware.ts';
import type { AuthService } from './auth.service.ts';
export function authRoutes(auth: AuthService, config: Config) {
  const router = Router();
  const controller = authController(auth, config);
  router.get('/connections', controller.connections);
  router.post('/logout', controller.logout);
  router.post(
    '/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Intenta más tarde.' },
      },
    }),
    controller.login
  );
  router.use(authenticate(auth));
  router.get('/me', controller.me);
  return router;
}
