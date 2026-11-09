import { Router, type Request, type Response, type RequestHandler } from 'express';
import { z } from 'zod';
import { pgId } from '../../../shared/relational.ts';
import { configurablePermissions } from '../../../shared/permissions.ts';
import type { RelationalService, Catalog } from './relational.service.ts';
import { AppError } from '../../shared/errors.ts';
const mutation = z.object({ revision: z.number().int().nonnegative(), data: z.unknown() }).strict();
export function relationalRoutes(service: () => RelationalService) {
  const router = Router();
  const handle =
    (work: (req: Request, res: Response) => Promise<unknown>, status = 200): RequestHandler =>
    async (req, res) => {
      try {
        res.status(status).json(await work(req, res));
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === '23505')
          throw new AppError(
            409,
            'Ya existe un registro con ese código, fecha u orden de evaluación'
          );
        if (code === '23503')
          throw new AppError(
            409,
            'El registro tiene referencias inexistentes o está siendo utilizado'
          );
        if (code === '23514' || code === '22003')
          throw new AppError(422, 'Los valores no cumplen las restricciones del modelo');
        if (code === '42501')
          throw new AppError(
            503,
            'La cuenta PostgreSQL no tiene permisos para preparar o utilizar el soporte de mantenimiento. Un administrador puede ejecutar el script 003.',
            'MAINTENANCE_DATABASE_PERMISSIONS'
          );
        if (code === '42P01' || code === '3F000')
          throw new AppError(
            503,
            'Prepara las tablas y el esquema de soporte en public de la conexi?n seleccionada',
            'MAINTENANCE_SCHEMA_MISSING'
          );
        throw error;
      }
    };
  router.get(
    '/bootstrap',
    handle((_req, res) => service().read(res.locals.user))
  );
  router.post(
    '/assets',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().asset(res.locals.user, body.revision, body.data);
    }, 201)
  );
  router.put(
    '/assets/:id',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().asset(res.locals.user, body.revision, body.data, pgId.parse(req.params.id));
    })
  );
  for (const key of ['units', 'types', 'parts'] as Catalog[]) {
    router.post(
      '/' + key,
      handle((req, res) => {
        const body = mutation.parse(req.body);
        return service().catalog(res.locals.user, body.revision, key, body.data);
      }, 201)
    );
    router.put(
      '/' + key + '/:id',
      handle((req, res) => {
        const body = mutation.parse(req.body);
        return service().catalog(
          res.locals.user,
          body.revision,
          key,
          body.data,
          pgId.parse(req.params.id)
        );
      })
    );
  }
  router.post(
    '/meters',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().meter(res.locals.user, body.revision, body.data);
    }, 201)
  );
  router.put(
    '/meters/:id',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().meter(res.locals.user, body.revision, body.data, pgId.parse(req.params.id));
    })
  );
  router.post(
    '/readings',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().reading(res.locals.user, body.revision, body.data);
    }, 201)
  );
  router.put(
    '/readings/:id',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().reading(
        res.locals.user,
        body.revision,
        body.data,
        pgId.parse(req.params.id)
      );
    })
  );
  router.put(
    '/roles/:role',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      const role = z.enum(['technician', 'viewer']).parse(req.params.role);
      const permissions = z
        .array(z.enum(configurablePermissions))
        .max(configurablePermissions.length)
        .parse(body.data);
      return service().saveRole(res.locals.user, body.revision, role, permissions);
    })
  );
  router.post(
    '/plans',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().plan(res.locals.user, body.revision, body.data);
    }, 201)
  );
  router.post(
    '/plans/:id/replace',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().plan(res.locals.user, body.revision, body.data, pgId.parse(req.params.id));
    }, 201)
  );
  router.put(
    '/plans/:id/state',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().planState(
        res.locals.user,
        body.revision,
        pgId.parse(req.params.id),
        body.data
      );
    })
  );
  router.post(
    '/orders',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().order(res.locals.user, body.revision, body.data);
    }, 201)
  );
  router.post(
    '/orders/:id/complete',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      return service().complete(
        res.locals.user,
        body.revision,
        pgId.parse(req.params.id),
        body.data
      );
    })
  );
  router.post(
    '/orders/:id/cancel',
    handle((req, res) => {
      const body = mutation.parse(req.body);
      z.object({}).strict().parse(body.data);
      return service().cancel(res.locals.user, body.revision, pgId.parse(req.params.id));
    })
  );
  return router;
}
