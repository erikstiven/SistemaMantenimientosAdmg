# SisMant · Mantenimiento PostgreSQL

La aplicación en modo API utiliza las tablas `public.*_mant` de la conexión elegida en el inicio de sesión. La autenticación permanece en las tablas Comercial/SAE de esa misma conexión. No se exige otra base de datos.

## Preparación

Requiere Node.js 24+, npm y PostgreSQL.

```powershell
npm ci
Copy-Item .env.example .env
```

Configura `VITE_DATA_MODE=api` y las URLs PostgreSQL privadas del backend en `.env`. Define los IDs, etiquetas, variable de URL, modo de autenticación, formato de contraseña y perfiles autorizados en `server/connections.ts`. Nunca pongas secretos en variables `VITE_*` ni en el código.

En **cada base configurada**, ejecuta manualmente:

1. [`sql/001_erp_asset_maintenance.sql`](sql/001_erp_asset_maintenance.sql), si aún no existe `saeact.act_usa_mant`.
2. Tu DDL de las diez tablas de mantenimiento, o [`sql/002_maintenance.sql`](sql/002_maintenance.sql). Es una instalación inicial: falla si ya existen tablas; no borra ni sustituye datos.
3. [`sql/003_maintenance_support.sql`](sql/003_maintenance_support.sql). Prepara la revisión, auditoría, correcciones de lecturas y permisos por rol en `sismant`. Puede repetirse en instalaciones existentes.

El servidor **no ejecuta los scripts 001/002**: crear las tablas de negocio y seleccionar activos sigue a cargo del ERP/administrador. No carga datos de demostración en PostgreSQL. El almacenamiento técnico de sesiones se prepara tras el primer ingreso válido y el soporte de revisión/auditoría se prepara en la primera consulta de mantenimiento, si la cuenta PostgreSQL tiene permisos. El script 003 y `db:migrate` permiten prepararlos manualmente con una cuenta administradora cuando la cuenta de ejecución no tiene permisos de creación. Los activos existentes quedan en `N`; se seleccionan en el ERP.

Para preparar el almacenamiento de sesiones en una instalación nueva:

```powershell
npm run db:migrate
```

Como alternativa a ejecutar manualmente el script 003, `npm run db:migrate-maintenance -- --support` lo aplica a las conexiones configuradas. `--install` ejecuta también 002 y debe usarse solo cuando las tablas todavía no existen. No uses `--install` después de cargar un dataset.

Configura la correspondencia de activos globales descrita más abajo. Arranca el backend y el frontend en terminales diferentes:

```powershell
npm run dev:server
```

```powershell
npm run dev
```

Frontend: `http://localhost:5174`; Vite reenvía `/api` a `127.0.0.1:3001`. `APP_ORIGIN` debe coincidir con el origen público de la interfaz. Reinicia el backend al cambiar su configuración.

## Tablas y comportamiento

| Módulo                                             | Tablas                                                      |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Unidades                                           | `saeumd_mant`                                               |
| Tipos de mantenimiento                             | `saetima_mant`                                              |
| Medidores                                          | `saemedi_mant`                                              |
| Lecturas                                           | `saelect_mant`                                              |
| Planes y reglas                                    | `saeplan_mant`, `saeregl_mant`                              |
| Repuestos                                          | `saerepu_mant`                                              |
| Órdenes y consumos                                 | `saeordm_mant`, `saedetm_mant`                              |
| Control de concurrencia e historial de operaciones | `sismant.maintenance_revision`, `sismant.maintenance_audit` |

Las escrituras son operaciones específicas del módulo, con IDs generados por `BIGSERIAL`. Ya no se reemplaza un agregado JSON. Cada operación verifica la revisión y guarda cambios, auditoría y nueva revisión en la misma transacción. Una revisión antigua recibe 409; recarga antes de continuar. Las consultas devuelven únicamente los activos y registros de la conexión, empresa y sucursal de la sesión. Los catálogos de unidades, tipos y repuestos se comparten dentro de cada base configurada.

Reglas implementadas:

- Los medidores requieren una unidad activa de tipo `MEDIDOR`. El activo y la unidad de un medidor creado no se cambian: se desactiva y se crea otro.
- Las lecturas tienen fecha y hora. No se editan ni borran; se impiden duplicados y retrocesos, incluso al insertar lecturas históricas. Tampoco se permite contradecir una ejecución ya realizada. Para un cambio de contador se crea otro medidor y otra estrategia; no se simulan reinicios del contador existente.
- Los planes admiten hasta 100 reglas ordenadas con condición uniforme OR/AND. Calendario requiere DIA/MES, frecuencia entera, sin medidor ni base numérica. Las reglas de medidor requieren el mismo activo y unidad y una base inicial.
- `valor_base` y `fecha_inicio` son inmutables durante la ejecución. El siguiente vencimiento se calcula desde la última orden `REALIZADA`, usando su valor y fecha. Las órdenes pendientes y canceladas no reinician ciclos. MES usa meses calendario y respeta fin de mes/bisiestos; la anticipación de calendario siempre se mide en días.
- Sustituir estrategia cierra el plan anterior y crea otro, preservando reglas y órdenes históricas. La nueva fecha no puede ser anterior al último servicio. Primero se deben completar o cancelar las órdenes pendientes del plan anterior.
- Las órdenes solo usan `PENDIENTE`, `REALIZADA` y `CANCELADO`. Completar y cancelar son operaciones terminales. La ejecución requiere una lectura exacta respaldada por la última lectura registrada hasta esa fecha.
- Completar guarda todos los consumos y la orden de forma atómica. Cantidad, costo y subtotal se calculan con decimales exactos y redondeo a dos posiciones, compatibles con `NUMERIC(14,2)`; no se usan sumas monetarias binarias de JavaScript.
- Una orden tiene un único `valor_realizado`. Se impide completar un plan con varios medidores distintos: el DDL necesita un detalle por regla antes de soportar esa operación. No se inventan valores para los otros medidores.
- Un activo excluido en el ERP conserva su historial, pero no acepta nuevos medidores, planes, órdenes o lecturas. Los códigos ERP no se reescriben y no existe CRUD de activos en SisMant.

Los IDs `BIGINT` y los decimales viajan como cadenas, incluidos IDs mayores a `Number.MAX_SAFE_INTEGER`. Las fechas y horas sin zona se conservan como valores de negocio; el día de evaluación predeterminado corresponde a `America/Guayaquil`. La interfaz permite evaluar vencimientos a otra fecha sin modificar los registros.

## Identidad de activos ERP

`saeact` utiliza `act_cod_act`, `act_cod_empr` y `act_cod_sucu`. La interfaz muestra `act_clave_act` como referencia visible y `act_nom_act` como nombre. **No se asume una columna `id_activo` ni se copia el código ERP como identidad global.** El DDL recibido no define la integración que resuelve esa identidad.

El adaptador nativo asigna autom?ticamente una identidad persistente a cada activo con `act_usa_mant = 'S'`. La correspondencia se guarda en `sismant.asset_identity`, usando la clave conexi?n + empresa + sucursal + act_cod_act. No cambia el activo ERP y conserva la identidad al reiniciar, volver a consultar o excluir posteriormente el activo. La secuencia t?cnica se agrega con el soporte 003.

Configura un `assetNamespace` entero entre 1 y 2097151, ?nico por conexi?n. Las conexiones actuales usan 1, 2 y 3. No lo cambies ni lo reutilices para otra conexi?n despu?s de generar identidades. Cada namespace dispone de un bloque de 2^42 identidades; la combinaci?n namespace + secuencia local produce un BIGINT positivo sin redondeo ni copia del c?digo ERP. La configuraci?n rechaza namespaces repetidos y el proveedor rechaza cambios que invalidar?an correspondencias existentes.

La vista externa y las correspondencias expl?citas siguientes son opcionales, para integraciones o datasets con identidades previamente asignadas:

**Integración existente mediante vista.** Configura `assetIntegrationView: 'integracion.activos_mantenimiento'` en cada conexión. Debe ser una vista o relación accesible desde esa base que devuelva exactamente:

```text
id_activo       BIGINT positivo, globalmente único
conexion_erp    ID estable de server/connections.ts
empresa_id     BIGINT
sucursal_id    BIGINT
act_cod_act    código original del ERP
nombre         nombre del activo
tipo           descripción del tipo
act_usa_mant   S o N, procedente del ERP
```

El proveedor comprueba duplicados, valida el contrato y filtra por la sesión. La aplicación no crea esa vista, no sincroniza tablas remotas ni inventa una integración entre bases.

**Correspondencias explícitas con el catálogo nativo.** Sin `assetIntegrationView`, se lee `public.saeact` y se resuelve la identidad desde `ASSET_IDENTITIES` en `server/asset-identities.ts`. Agrega las correspondencias reales ya definidas por tu integración/dataset:

```ts
// Ejemplo de estructura; reemplazar TODOS los valores con la correspondencia real.
{
  id_activo: '9007199254740993',
  connectionId: 'supermag',
  empresaId: '1',
  sucursalId: '1',
  actCodAct: '42',
}
```

La lista inicial está vacía. Un activo marcado con `S` sin correspondencia genera un aviso y no se permite referenciarlo en medidores o planes. Esto permite preparar los catálogos sin guardar identidades equivocadas. Si todavía no existe un registro global de identidades, esa integración sigue pendiente: agregar las diez tablas por sí solo no la crea.

## Autenticación y permisos

Se conserva la selección de conexión y las sesiones independientes. `supermag` valida Comercial; `principal` conserva el modo combinado. Los nombres de usuario no distinguen mayúsculas, las contraseñas sí; se rechazan identidades ambiguas.

| Modo         | Cuenta y restricciones                                       |
| ------------ | ------------------------------------------------------------ |
| `commercial` | Comercial activo, no vencido y perfil autorizado             |
| `combined`   | Comercial más vínculo por `usua_cod_usua` con SAE no vencido |
| `sae`        | SAE no vencido y código de usuario autorizado explícitamente |

En Comercial el mapa `roles` usa `perfil_id`; en SAE usa `usua_cod_usua`. Los perfiles sin mapa no acceden. La asignación del perfil de cada cuenta se administra en el ERP. En **Roles y permisos**, un administrador de SisMant configura los permisos de Operador (`technician`) y Consulta (`viewer`) para la conexión y empresa de su sesión. Por defecto Consulta tiene acceso de lectura y Operador puede realizar operaciones de mantenimiento. La corrección de lecturas se habilita inicialmente para Administrador. El rol Administrador conserva sus permisos de configuración y los activos se administran desde el ERP. Para los módulos relacionales se exige empresa y sucursal en la identidad.

Se validan bcrypt, scrypt y MD5 legado, según `passwordFormat` de la conexión; no hay fallback a otro algoritmo ni validación en texto plano. MD5 solo se usa para compatibilidad con las credenciales comerciales existentes y no para crear contraseñas. `npm run db:inspect-auth` inspecciona tipos y cantidades por formato sin imprimir hashes o contraseñas.

La cookie es HttpOnly, SameSite Strict y Secure en producción. Solo se guarda SHA-256 del token. Cada solicitud revalida el estado y perfil del usuario. El tiempo comercial se interpreta en minutos salvo `sessionTimeUnit: 'seconds'`, limitado por `SESSION_HOURS`. La duración es absoluta. Los encabezados de contexto confirman conexión y usuario, sin poder elegir otro pool; un cambio de sesión entre pestañas bloquea operaciones pendientes. Cerrar sesión revoca el token y limpia los datos de la interfaz.

## API

Prefijo `/api/v1`. Se mantienen `/auth/connections`, `/auth/login`, `/auth/me`, `/auth/logout` y `/health`. `/state` devuelve 410: el agregado antiguo se retiró.

| Método     | Ruta                                 | Operación                                     |
| ---------- | ------------------------------------ | --------------------------------------------- |
| GET        | `/maintenance/bootstrap`             | Catálogos y registros del ámbito de la sesión |
| POST / PUT | `/maintenance/units`, `/units/:id`   | Unidades (admin)                              |
| POST / PUT | `/maintenance/types`, `/types/:id`   | Tipos (admin)                                 |
| POST / PUT | `/maintenance/parts`, `/parts/:id`   | Repuestos                                     |
| POST / PUT | `/maintenance/meters`, `/meters/:id` | Medidores                                     |
| POST       | `/maintenance/readings`              | Registrar lectura                             |
| POST       | `/maintenance/plans`                 | Crear plan y reglas                           |
| POST       | `/maintenance/plans/:id/replace`     | Sustituir estrategia                          |
| PUT        | `/maintenance/plans/:id/state`       | Activar/desactivar plan                       |
| POST       | `/maintenance/orders`                | Emitir orden                                  |
| POST       | `/maintenance/orders/:id/complete`   | Ejecutar con detalles                         |
| POST       | `/maintenance/orders/:id/cancel`     | Cancelar                                      |

Las mutaciones reciben `{ revision, data }`; IDs y cantidades son cadenas. No se aceptan borrados directos de lecturas, reglas u órdenes históricas. Se conservan consultas parametrizadas, validación Zod, comprobación de origen, Helmet y límites de solicitudes/cuerpo. Actualmente la carga inicial admite hasta 20.000 filas por colección y los últimos 200 eventos de auditoría; si se supera, se rechaza explícitamente sin truncar datos operativos. La paginación de grandes datasets queda como ampliación.

## Datos anteriores y verificación

Los datos de `sismant.state` y del navegador no se borran ni se convierten automáticamente. Importarlos requiere resolver primero las identidades globales, unidades, tipos y referencias; conserva sus respaldos. El modo `VITE_DATA_MODE=local` mantiene exclusivamente el prototipo anterior, separado de la aplicación relacional.

```powershell
npm run typecheck:server
npm run lint
npm test
npm run build
npm run smoke:production
```

Las pruebas cubren autenticación, aislamiento, restricciones del modelo, OR/AND, ciclos, precisión, cancelación y rollback. Usan `pg-mem`; sus transacciones se emulan con snapshots porque no implementa el motor transaccional de PostgreSQL. No equivalen a validar bloqueo/aislamiento bajo concurrencia real. La prueba de producción verifica el servidor compilado, recursos, API relacional y cookie Secure. Antes del despliegue, ejecuta los scripts y prueba el flujo con PostgreSQL real y tu integración de activos. No se ejecutaron migraciones en los ERP durante esta refactorización.

En producción configura `VITE_DATA_MODE=api` antes de compilar, `NODE_ENV=production`, `APP_ORIGIN` con tu origen HTTPS y certificados PostgreSQL verificados según tu infraestructura. Ejecuta `npm run build` y `npm start`. La cuenta de ejecución necesita lectura de las tablas de autenticación/activos, uso de las secuencias e inserción/actualización de mantenimiento y auditoría. Respalda las tablas con herramientas PostgreSQL. No se ha desplegado infraestructura externa.
