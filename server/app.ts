import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { resolve } from 'node:path';
import type { Config } from './config.ts';
import { Databases } from './database.ts';
import { authenticate, assertSessionContext } from './modules/auth/auth.middleware.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { RelationalRepository } from './modules/maintenance/relational.repository.ts';
import { relationalRoutes } from './modules/maintenance/relational.routes.ts';
import { RelationalService } from './modules/maintenance/relational.service.ts';
import { AppError, errorHandler } from './shared/errors.ts';
export async function createApp(config: Config, db = new Databases(config)) {
  const auth = new AuthService(db, config);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes' } },
    })
  );
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== config.APP_ORIGIN)
        throw new AppError(403, 'Origen no permitido');
      if (!req.is('application/json')) throw new AppError(415, 'Se requiere application/json');
    }
    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/v1/auth', authRoutes(auth, config));
  const routers = new Map(
    db
      .list()
      .map(({ id }) => [
        id,
        relationalRoutes(
          () =>
            new RelationalService(
              new RelationalRepository(db.maintenance(id), db.get(id).definition, db.get(id).db)
            )
        ),
      ])
  );
  app.use('/api/v1', authenticate(auth), (req, res, next) => {
    assertSessionContext(req, res.locals.user);
    const router = routers.get(res.locals.user.connectionId ?? '');
    if (!router) throw new AppError(401, 'Sesión sin base de datos');
    if (req.path === '/state')
      throw new AppError(
        410,
        'El almacenamiento JSON fue sustituido por las tablas de mantenimiento',
        'LEGACY_STATE_RETIRED'
      );
    if (req.path.startsWith('/maintenance/')) {
      req.url = req.url.slice('/maintenance'.length);
      router(req, res, next);
    } else next();
  });
  if (config.NODE_ENV === 'production') {
    const frontend = resolve('dist');
    app.use(express.static(frontend, { index: 'index.html' }));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => res.sendFile(resolve(frontend, 'index.html')));
  }
  app.use((_req, _res, next) => next(new AppError(404, 'Ruta no encontrada')));
  app.use(errorHandler);
  return { app, db };
}
