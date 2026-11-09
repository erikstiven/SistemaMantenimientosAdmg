import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_ERROR'
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  const status =
    typeof error?.status === 'number' && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  if (status === 500) console.error('Error interno del servidor');
  res.status(status).json({
    error: {
      code: 'HTTP_ERROR',
      message:
        status === 413
          ? 'Solicitud demasiado grande'
          : status === 400
            ? 'JSON inválido'
            : 'Error interno del servidor',
    },
  });
};
