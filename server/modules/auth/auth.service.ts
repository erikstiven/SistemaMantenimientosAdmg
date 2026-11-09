import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { compare } from 'bcryptjs';
import type { User } from '../../../shared/state.ts';
import type { Config } from '../../config.ts';
import { Databases, type Connection } from '../../database.ts';
import { AppError } from '../../shared/errors.ts';
import { AuthRepository, type Credential } from './auth.repository.ts';
const derive = promisify(scrypt);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await derive(password, salt, 64)) as Buffer).toString('hex')}`;
}
const dummy = hashPassword(randomBytes(32).toString('hex'));
export async function verifyPassword(
  password: string,
  stored: string,
  format: Connection['definition']['passwordFormat']
) {
  // Compatibility only: validate the existing digest, never create or rewrite MD5 passwords.
  // Explicit per-connection configuration prevents fallback to weaker algorithms.
  if (format === 'legacy-md5' && /^[a-f0-9]{32}$/i.test(stored)) {
    const actual = createHash('md5').update(password, 'utf8').digest();
    return timingSafeEqual(actual, Buffer.from(stored, 'hex'));
  }
  if (format === 'bcrypt' && /^\$2[aby]\$(0[4-9]|1[0-6])\$[./A-Za-z0-9]{53}$/.test(stored)) {
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    return compare(password, stored.replace(/^\$2y\$/, '$2b$'));
  }
  if (format === 'scrypt' && /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(stored)) {
    const [salt, hex] = stored.split(':');
    return timingSafeEqual((await derive(password, salt, 64)) as Buffer, Buffer.from(hex, 'hex'));
  }
  const [salt] = (await dummy).split(':');
  await derive(password, salt, 64);
  return false;
}
export class AuthService {
  constructor(
    private databases: Databases,
    private config: Config
  ) {}
  connections() {
    return this.databases.list();
  }
  private repository(connection: Connection) {
    return new AuthRepository(connection.db, connection.definition);
  }
  private accessFailure(record: Credential, connection: Connection) {
    if (![true, 1, '1', 'S', 'true'].includes(record.enabled))
      return {
        code: 'USER_DISABLED',
        message: 'Tu usuario está deshabilitado en el sistema comercial.',
      };
    if (!record.valid)
      return {
        code: 'USER_EXPIRED',
        message: 'Tu usuario comercial está vencido. Solicita su habilitación al administrador.',
      };
    if (!record.sae_valid)
      return {
        code: 'SAE_ACCESS_DENIED',
        message:
          'La contraseña comercial es correcta, pero el usuario SAE relacionado no existe o está vencido. La conexión exige validar ambas tablas.',
      };
    if (!Object.hasOwn(connection.definition.roles, String(record.profile)))
      return {
        code: 'PROFILE_NOT_AUTHORIZED',
        message:
          'La contraseña es correcta, pero tu perfil no tiene un rol autorizado en esta aplicación.',
      };
    if (!Number.isSafeInteger(Number(record.id)))
      return {
        code: 'INVALID_USER_ID',
        message: 'El identificador del usuario no es compatible con la aplicación.',
      };
  }
  private identity(record: Credential | undefined, connection: Connection): User | undefined {
    if (!record || this.accessFailure(record, connection)) return;
    const role = connection.definition.roles[String(record.profile)];
    return {
      id: Number(record.id),
      username: record.username,
      role,
      connectionId: connection.definition.id,
      connectionLabel: connection.definition.label,
      companyId: record.companyId,
      branchId: record.branchId,
      assetScope:
        role === 'admin' && connection.definition.adminAssetScope === 'company'
          ? 'company'
          : 'branch',
    };
  }
  private async available<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof AppError) throw error;
      const code = (error as { code?: string })?.code;
      if (code === '42501')
        throw new AppError(
          503,
          'La conexión PostgreSQL no tiene permisos para consultar usuarios o preparar el almacenamiento de sesiones. Un administrador puede ejecutar npm run db:migrate.',
          'AUTH_DATABASE_PERMISSIONS'
        );
      if (code === '42P01' || code === '3F000' || code === '42703')
        throw new AppError(
          503,
          'La base seleccionada no contiene las tablas o columnas de autenticación requeridas por su configuración.',
          'AUTH_SCHEMA_INCOMPATIBLE'
        );
      throw new AppError(
        503,
        'La base de datos seleccionada no está disponible o requiere configuración',
        'DATABASE_UNAVAILABLE'
      );
    }
  }
  async login(connectionId: string, username: string, password: string) {
    const connection = this.databases.get(connectionId);
    return this.available(async () => {
      await connection.db.query('SELECT 1');
      const repository = this.repository(connection);
      const record = await repository.byName(username);
      const valid = await verifyPassword(
        password,
        record?.password ?? '',
        connection.definition.passwordFormat
      );
      if (!valid || !record)
        throw new AppError(
          401,
          'Usuario o contraseña comercial incorrectos',
          'INVALID_CREDENTIALS'
        );
      // Reveal account restrictions only after verifying the supplied password.
      const failure = this.accessFailure(record, connection);
      if (failure) throw new AppError(401, failure.message, failure.code);
      const user = this.identity(record, connection)!;
      const token = `${connectionId}.${randomBytes(32).toString('hex')}`;
      const minutes = Number(record?.sessionMinutes);
      const duration =
        Number.isFinite(minutes) && minutes > 0
          ? Math.min(
              minutes * (connection.definition.sessionTimeUnit === 'seconds' ? 1000 : 60000),
              this.config.SESSION_HOURS * 3600000
            )
          : this.config.SESSION_HOURS * 3600000;
      await repository.prepareSessions();
      await repository.addSession(digest(token), user.id, Date.now() + duration);
      return { token, user };
    });
  }
  private tokenConnection(token: string) {
    if (!/^[a-z0-9_-]{1,50}\.[a-f0-9]{64}$/.test(token)) return;
    return this.databases.list().some(c => c.id === token.split('.')[0])
      ? this.databases.get(token.split('.')[0])
      : undefined;
  }
  async authenticate(token: string) {
    const connection = this.tokenConnection(token);
    if (!connection) return;
    return this.available(async () => {
      const repository = this.repository(connection);
      const session = await repository.session(digest(token));
      if (!session) return;
      const user = this.identity(await repository.byId(Number(session.user_id)), connection);
      if (!user) await repository.removeSession(digest(token));
      return user;
    });
  }
  async logout(token: string) {
    const connection = this.tokenConnection(token);
    if (connection)
      await this.available(() => this.repository(connection).removeSession(digest(token)));
  }
}
