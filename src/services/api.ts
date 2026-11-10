import type { Snapshot, User } from '../../shared/state';
export const apiMode = import.meta.env.VITE_DATA_MODE === 'api';
let sessionContext: Record<string, string> = {};
async function identify(work: Promise<User>) {
  const user = await work;
  sessionContext = {
    'X-Sismant-Connection': user.connectionId ?? '',
    'X-Sismant-User': String(user.id),
  };
  return user;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: { path: string; message: string }[] = []
  ) {
    super(message);
  }
}
async function requestResponse(path: string, options: RequestInit = {}) {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...sessionContext, ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error?.message ?? 'No se pudo comunicar con el servidor',
      response.status,
      Array.isArray(body.error?.details) ? body.error.details : []
    );
  }
  return response;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await requestResponse(path, options);
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function requestPdf(path: string) {
  const response = await requestResponse(path, { headers: { Accept: 'application/pdf' } });
  if (!response.headers.get('content-type')?.startsWith('application/pdf'))
    throw new Error('El servidor no devolvió un reporte PDF. Actualiza la API de SisMant.');
  return response.blob();
}
export const api = {
  connections: () => request<{ id: string; label: string }[]>('/auth/connections'),
  me: () => identify(request<User>('/auth/me')),
  login: (connectionId: string, username: string, password: string) =>
    identify(
      request<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ connectionId, username, password }),
      })
    ),
  logout: async () => {
    await request<void>('/auth/logout', { method: 'POST' });
    sessionContext = {};
  },
  load: () => request<Snapshot>('/state'),
  save: (snapshot: Snapshot) =>
    request<Snapshot>('/state', { method: 'PUT', body: JSON.stringify(snapshot) }),
};
