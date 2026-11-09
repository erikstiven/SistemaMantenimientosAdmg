# Requerimientos de desarrollo y ajustes — Sistema de Mantenimientos

**Fecha:** 09/11/2026  
**Estado:** Requerimientos por implementar  
**Objetivo:** Mejorar la navegación, la administración de permisos y las funcionalidades de Lecturas, Activos, Medidores y Planes de Mantenimiento.

## 1. Ajustes generales de navegación

### 1.1. URL dinámicas y persistencia del estado

- Mantener en la URL los parámetros relevantes de búsqueda, filtrado, paginación y vista.
- Permitir recargar la página sin perder los filtros o el contexto de consulta.
- Habilitar enlaces directos a módulos y registros específicos.
- Garantizar que la navegación entre módulos y el uso de los botones Atrás/Adelante funcionen correctamente.
- Validar autenticación y permisos al acceder por enlaces directos.

**Criterio de aceptación:** Una URL compartida o recargada abre el módulo correcto y restaura los filtros y la vista representados en ella.

## 2. Módulo de Lecturas

### 2.1. Unidad de medida en Valor acumulado

- Mostrar junto al campo **Valor acumulado** la unidad del medidor seleccionado (por ejemplo, `km`, `h`).
- Actualizar la unidad automáticamente cuando cambie el medidor.

### 2.2. Observación predeterminada editable

- Generar una observación inicial que incluya fecha, hora, medidor y valor con unidad.
- Permitir al usuario editar libremente esa observación antes de guardar.
- Al modificar los datos de una lectura nueva, actualizar el texto generado mientras no haya sido personalizado manualmente.

**Ejemplo:** «Lectura registrada el 09/11/2026 a las 15:30, correspondiente al medidor de kilometraje, con un valor acumulado de 125.450 km».

### 2.3. Fecha y hora iniciales

- Precargar la fecha y hora actuales al abrir el formulario de nueva lectura, utilizando la zona horaria configurada para la aplicación.
- Permitir su modificación según las reglas y permisos aplicables.

### 2.4. Edición de lecturas

- Incorporar la acción **Editar lectura** para registros existentes.
- Restringirla según los permisos del rol del usuario.
- Actualizar las vistas y valores derivados que dependan de la lectura modificada.

### 2.5. Modal reutilizable

- Utilizar un único componente o lógica compartida para el modal de lectura en **Lecturas** y **Medidores**.
- Desde Medidores, abrirlo con el medidor correspondiente preseleccionado.
- Desde Lecturas, permitir seleccionar el medidor.
- Compartir validaciones, registro, edición y actualización de la interfaz.

**Criterio de aceptación:** Registrar o editar desde cualquiera de los dos módulos produce el mismo resultado y mantiene sincronizados los datos.

## 3. Roles y permisos

- Implementar un módulo para consultar y administrar los roles y permisos de la aplicación de mantenimientos.
- Identificar el rol asignado a cada usuario y aplicar sus permisos.
- Configurar permisos por módulo y acción: consultar, crear, editar, actualizar y otras operaciones que correspondan.
- Mostrar u ocultar acciones de la interfaz de acuerdo con los permisos.
- Verificar los permisos en el servidor, incluso cuando se acceda mediante URL directa o petición externa.
- Aplicar los permisos especialmente a la edición de lecturas, la edición de medidores y la administración de activos.

**Criterio de aceptación:** Un usuario sin permiso no puede ejecutar la acción, aunque intente acceder directamente a su ruta.

## 4. Módulo de Activos

### 4.1. Nombre

- Cambiar el nombre visible **Activos ERP** por **Activos**.

### 4.2. Administración

- Permitir consultar, buscar, crear, editar y actualizar activos.
- Incorporar el control del campo `act_usu_mant`:
  - `S`: Sí, el activo está habilitado para mantenimiento.
  - `N`: No, el activo no está habilitado para mantenimiento.
- Mostrar las opciones como **Sí** y **No**, conservando los valores `S` y `N` en los datos.
- Restringir la administración del módulo a usuarios con rol **Administrador**.

**Criterio de aceptación:** Un administrador puede gestionar los activos y modificar `act_usu_mant`; un usuario no autorizado no puede hacerlo.

## 5. Módulo de Medidores

### 5.1. Botón de registro

- Quitar el botón superior **Registrar lectura**.
- Mantener el registro de lecturas desde la acción correspondiente de cada medidor.

### 5.2. Lectura inicial automática

Al crear un **Nuevo Medidor**, crear también su primera lectura:

| Campo | Valor |
|---|---|
| Fecha | Valor de `act_fcmp_act` del activo asociado |
| Valor acumulado | `0` |
| Unidad | Unidad configurada para el medidor |

**Ejemplo:** Si `act_fcmp_act = 2017-06-09` y la unidad es `km`, registrar una lectura inicial de **0 km** con fecha **2017-06-09**.

- Ejecutar la creación del medidor y de su lectura inicial de forma consistente, evitando registros parciales o duplicados.
- Definir el tratamiento de activos sin `act_fcmp_act` antes de implementar esta regla.

### 5.3. Información de la tarjeta del medidor

- Anteponer la etiqueta **Valor actual:** al valor acumulado y su unidad.
- Mostrar debajo **Última lectura:** con la fecha y hora del registro más reciente.

**Ejemplo:**

> **Medidor de kilometraje**  
> Valor actual: **125.450 km**  
> Última lectura: **09/11/2026, 15:30**

### 5.4. Edición según permisos

- Mostrar y permitir la acción **Editar medidor** únicamente a usuarios autorizados.

### 5.5. Planes asociados

- Agregar una acción para abrir un modal con los planes de mantenimiento asociados al medidor.
- Permitir seleccionar un plan desde ese modal.
- Al seleccionarlo, navegar a **Planes de Mantenimiento** con el filtro o búsqueda del plan ya aplicado en la URL.

**Criterio de aceptación:** El usuario llega al listado de planes y ve el plan seleccionado como resultado de una búsqueda filtrada, incluso después de recargar.

## 6. Módulo de Planes de Mantenimiento

### 6.1. Dos vistas

1. **Listado (predeterminada):** conservar la vista y las funcionalidades actuales.
2. **Calendario:** mostrar eventos y fechas propuestas de mantenimiento.

- Permitir alternar entre ambas vistas.
- Mantener en la URL la vista y los filtros relevantes.

### 6.2. Generación de propuestas en el calendario

Calcular las fechas propuestas en función de:

- La regla y frecuencia configuradas en el plan.
- La anticipación de alerta.
- Las fechas de referencia, inicio o próximas ejecuciones.
- Las lecturas del medidor, cuando el mantenimiento dependa de uso acumulado.

**Importante:** Las fechas calculadas son **propuestas**, no órdenes, alertas ni registros históricos reales. La visualización de una propuesta no debe crear registros automáticamente.

Cuando un plan dependa de kilómetros u horas y no sea posible determinar una fecha exacta, mostrar una estimación solo si existen datos suficientes, diferenciándola de una fecha calculada por calendario.

### 6.3. Acciones desde una propuesta

Al seleccionar una fecha propuesta, mostrar las acciones permitidas, por ejemplo:

- **Registrar orden de mantenimiento**.
- **Registrar alerta de mantenimiento**.
- **Ver plan de mantenimiento**.
- **Consultar historial relacionado**, si existe.

Prellenar la información del plan y del activo en los formularios correspondientes.

### 6.4. Registro y trazabilidad

- Crear el registro real únicamente cuando el usuario confirme la acción.
- Relacionar las órdenes, alertas y registros históricos con el plan correspondiente.
- Reflejar inmediatamente el nuevo estado en el calendario.
- Evitar duplicados involuntarios para una misma ejecución o evento.

### 6.5. Estados visuales

Diferenciar claramente, mediante etiquetas y colores, al menos:

| Estado | Significado |
|---|---|
| Propuesta | Fecha calculada; todavía no existe un registro real |
| Orden registrada | Existe una orden de mantenimiento creada |
| Alerta registrada | Existe una alerta de mantenimiento creada |
| Historial | Existe información histórica relacionada |

**Criterio de aceptación:** El calendario permite distinguir lo planificado de lo registrado, abrir el plan asociado y generar registros reales sin duplicaciones.

## 7. Requisitos transversales

- Respetar la arquitectura y las relaciones de datos existentes.
- Reutilizar componentes y lógica de negocio para evitar duplicación de código.
- Validar los formularios y permisos tanto en la interfaz como en el servidor.
- Mantener consistencia entre Activos, Medidores, Lecturas y Planes de Mantenimiento.
- Garantizar una interfaz adaptable a escritorio y dispositivos móviles.
- Probar navegación, filtros, recarga, enlaces directos, creación, edición y restricciones por rol.

## 8. Resultado esperado

La aplicación deberá permitir administrar activos y medidores, registrar y corregir lecturas según permisos, navegar mediante enlaces persistentes y gestionar los mantenimientos desde un calendario que distinga **propuestas** de **órdenes, alertas e historiales efectivamente registrados**.

---

**Nota:** Este documento define los requisitos funcionales solicitados. Los detalles técnicos no especificados (por ejemplo, reglas de estimación, permisos exactos por rol y tratamiento de fechas faltantes) deberán validarse durante el diseño e implementación.
