# Requerimientos de desarrollo y ajustes — Sistema de Mantenimientos

**Fecha:** 09/11/2026  
**Estado:** Requerimientos por implementar  
**Objetivo:** Mejorar la navegación, la administración de permisos y las funcionalidades de Lecturas, Activos, Medidores y Planes de Mantenimiento.

---

## 1. Ajustes generales de navegación

### 1.1. URL dinámicas y persistencia del estado
- Mantener en la URL los parámetros relevantes de búsqueda, filtrado, paginación y vista.
- Permitir recargar la página sin perder los filtros o el contexto de consulta.
- Habilitar enlaces directos a módulos y registros específicos.
- Garantizar que la navegación entre módulos y el uso de los botones Atrás/Adelante funcionen correctamente.
- Validar autenticación y permisos al acceder por enlaces directos.

**Criterio de aceptación:** Una URL compartida o recargada abre el módulo correcto y restaura los filtros y la vista representados en ella.

---

## 2. Módulo de Lecturas

### 2.1. Unidad de medida en Valor acumulado
- Mostrar junto al campo **Valor acumulado** la unidad del medidor seleccionado (por ejemplo, `km`, `h`).
- Actualizar la unidad automáticamente cuando cambie el medidor.

### 2.2. Observación predeterminada editable
- Generar una observación inicial que incluya fecha, hora, medidor y valor con unidad.
- Permitir al usuario editar libremente esa observación antes de guardar.
- Al modificar los datos de una lectura nueva, actualizar el texto generado mientras no haya sido personalizado manualmente.
- **Ejemplo:** «Lectura registrada el 09/11/2026 a las 15:30, correspondiente al medidor de kilometraje, con un valor acumulado de 125.450 km».

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

---

## 3. Roles y permisos

- Implementar un módulo para consultar y administrar los roles y permisos de la aplicación de mantenimientos.
- Identificar el rol asignado a cada usuario y aplicar sus permisos.
- Configurar permisos por módulo y acción: consultar, crear, editar, actualizar y otras operaciones que correspondan.
- Mostrar u ocultar acciones de la interfaz de acuerdo con los permisos.
- Verificar los permisos en el servidor, incluso cuando se acceda mediante URL directa o petición externa.
- Aplicar los permisos especialmente a la edición de lecturas, la edición de medidores y la administración de activos.

**Criterio de aceptación:** Un usuario sin permiso no puede ejecutar la acción, aunque intente acceder directamente a su ruta.

---

## 4. Módulo de Activos

### 4.1. Nombre
- Cambiar el nombre visible **Activos ERP** por **Activos**.

### 4.2. Administración
- Permitir consultar, buscar, crear, editar y actualizar activos.
- Incorporar el control del campo `act_usa_mant`:
  - `S`: Sí, el activo está habilitado para mantenimiento.
  - `N`: No, el activo no está habilitado para mantenimiento.
- Mostrar las opciones como **Sí** y **No**, conservando los valores `S` y `N` en los datos.
- Restringir la administración del módulo a usuarios con rol Administrador.

**Criterio de aceptación:** Un administrador puede gestionar los activos y modificar `act_usa_mant`; un usuario no autorizado no puede hacerlo.

---

## 5. Módulo de Medidores

### 5.1. Botón de registro
- Quitar el botón superior **Registrar lectura**.
- Mantener el registro de lecturas desde la acción correspondiente de cada medidor.

### 5.2. Lectura inicial automática
- Al crear un **Nuevo Medidor**, crear también su primera lectura:

| Campo | Valor |
|---|---|
| Fecha | Valor de `act_fcmp_act` del activo asociado |
| Valor acumulado | `0` |
| Unidad | Unidad configurada para el medidor |

- **Ejemplo:** Si `act_fcmp_act = 2017-06-09` y la unidad es `km`, registrar una lectura inicial de 0 km con fecha 2017-06-09.
- Ejecutar la creación del medidor y de su lectura inicial de forma consistente, evitando registros parciales o duplicados.
- Definir el tratamiento de activos sin `act_fcmp_act` antes de implementar esta regla.

### 5.3. Información de la tarjeta del medidor
- Anteponer la etiqueta **Valor actual:** al valor acumulado y su unidad.
- Mostrar debajo **Última lectura:** con la fecha y hora del registro más reciente.

> **Ejemplo:**  
> **Medidor de kilometraje**  
> Valor actual: **125.450 km**  
> Última lectura: **09/11/2026, 15:30**

### 5.4. Edición según permisos
- Mostrar y permitir la acción **Editar medidor** únicamente a usuarios autorizados.

### 5.5. Planes asociados
- Agregar una acción para abrir un modal con los planes de mantenimiento asociados al medidor.
- Permitir seleccionar un plan desde ese modal.
- Al seleccionarlo, navegar a Planes de Mantenimiento con el filtro o búsqueda del plan ya aplicado en la URL.

**Criterio de aceptación:** El usuario llega al listado de planes y ve el plan seleccionado como resultado de una búsqueda filtrada, incluso después de recargar.

---

## 6. Módulo de Planes de Mantenimiento

### 6.1. Dos vistas
- **Listado (predeterminada):** conservar la vista y las funcionalidades actuales.
- **Calendario:** mostrar eventos y fechas propuestas de mantenimiento.
- Permitir alternar entre ambas vistas.
- Mantener en la URL la vista y los filtros relevantes.

### 6.2. Generación de propuestas en el calendario
Calcular las fechas propuestas en función de:
- La regla y frecuencia configuradas en el plan.
- La anticipación de alerta.
- Las fechas de referencia, inicio o próximas ejecuciones.
- Las lecturas del medidor, cuando el mantenimiento dependa de uso acumulado.
- **Importante:** Las fechas calculadas son propuestas, no órdenes, alertas ni registros históricos reales. La visualización de una propuesta no debe crear registros automáticamente.
- Cuando un plan dependa de kilómetros u horas y no sea posible determinar una fecha exacta, mostrar una estimación solo si existen datos suficientes, diferenciándola de una fecha calculada por calendario.

### 6.3. Acciones desde una propuesta
Al seleccionar una fecha propuesta, mostrar las acciones permitidas, por ejemplo:
- Registrar orden de mantenimiento.
- Registrar alerta de mantenimiento.
- Ver plan de mantenimiento.
- Consultar historial relacionado, si existe.
- Prellenar la información del plan y del activo en los formularios correspondientes.

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

---

## 7. Requisitos transversales
- Respetar la arquitectura y las relaciones de datos existentes.
- Reutilizar componentes y lógica de negocio para evitar duplicación de código.
- Validar los formularios y permisos tanto en la interfaz como en el servidor.
- Mantener consistencia entre Activos, Medidores, Lecturas y Planes de Mantenimiento.
- Garantizar una interfaz adaptable a escritorio y dispositivos móviles.
- Probar navegación, filtros, recarga, enlaces directos, creación, edición y restricciones por rol.

---

## 8. Resultado esperado
La aplicación deberá permitir administrar activos y medidores, registrar y corregir lecturas según permisos, navegar mediante enlaces persistentes y gestionar los mantenimientos desde un calendario que distinga **propuestas** de **órdenes, alertas e historiales efectivamente registrados**.

---

**Nota:** Este documento define los requisitos funcionales solicitados. Los detalles técnicos no especificados (por ejemplo, reglas de estimación, permisos exactos por rol y tratamiento de fechas faltantes) deberán validarse durante el diseño e implementación.

---
---

# Segunda parte — Requerimientos adicionales y mejoras

**Fecha:** 10/11/2026  
**Estado:** Requerimientos por implementar  
**Objetivo:** Mejorar las acciones y permisos administrativos, la consulta del historial de lecturas, la generación de planes, el registro rápido de repuestos y la trazabilidad de operaciones.

---

## 9. Ajustes generales de interfaz y permisos

### 9.1. Acciones mediante iconos o botones
- Sustituir las acciones presentadas únicamente como texto por iconos o botones de colores, especialmente en Medidores e Historial de lecturas.
- Utilizar iconos reconocibles, colores consistentes y descripciones emergentes para identificar cada acción.
- Mantener accesibilidad, confirmaciones para operaciones sensibles y una presentación adaptable a dispositivos móviles.

**Criterio de aceptación:** Las acciones se identifican fácilmente y mantienen un comportamiento visual uniforme en los módulos intervenidos.

### 9.2. Eliminación de registros por Administrador
- Incorporar la acción **Eliminar** en los registros de todos los módulos, disponible exclusivamente para usuarios con rol Administrador.
- Ocultar o deshabilitar esta acción para los demás roles y validar el permiso también en el servidor.
- Solicitar confirmación antes de eliminar y controlar los registros relacionados para evitar inconsistencias.
- Registrar en el historial la operación, el usuario responsable, la fecha y el registro afectado.
- Definir, según las relaciones de datos y las reglas del negocio, cuándo corresponde eliminación lógica o física.

**Criterio de aceptación:** Solo un Administrador puede ejecutar eliminaciones autorizadas; la operación no deja referencias inconsistentes y queda registrada para auditoría.

---

## 10. Módulo de Medidores

### 10.1. Retiro de la opción «Editar última lectura»
- Eliminar la acción **Editar última lectura** del módulo de Medidores.
- Mantener las funcionalidades de registro y edición de lecturas previstas en el módulo de Lecturas, sujetas a sus permisos.

**Criterio de aceptación:** La acción «Editar última lectura» ya no aparece en Medidores, sin afectar la edición autorizada desde Lecturas.

### 10.2. Presentación de acciones
- Aplicar iconos o botones de colores a las acciones disponibles en los registros de Medidores.
- Mantener coherencia con los permisos de cada usuario y con el diseño general de la aplicación.

**Criterio de aceptación:** Las acciones de cada medidor son claras, consistentes y visibles únicamente cuando el usuario tiene autorización.

---

## 11. Módulo de Historial de lecturas

### 11.1. Filtros por Activo y Medidor
- Incorporar un selector **Activo**, con únicamente los activos que tengan lecturas registradas.
- Incorporar un selector **Medidor**, con únicamente los medidores que tengan lecturas registradas.
- Permitir el uso conjunto de ambos filtros, mostrando los registros que cumplan las condiciones seleccionadas.
- Cuando se seleccione un activo, limitar los medidores disponibles a los relacionados con él que tengan lecturas.

**Criterio de aceptación:** Los filtros muestran opciones con lecturas existentes y el historial se actualiza correctamente al combinarlos.

### 11.2. Columnas Activo, Medidor, Acumulado y Lectura
- Agregar la columna **Activo**, con el nombre o código del activo relacionado.
- Agregar la columna **Medidor**, con el nombre o código del medidor correspondiente.
- Agregar la columna **Acumulado**, que mostrará el valor acumulado actualmente presentado en la columna «Lectura».
- Modificar la columna **Lectura** para mostrar el incremento desde la medición anterior del mismo medidor.
- Calcular el incremento como $\text{acumulado actual} - \text{acumulado anterior}$, considerando el orden cronológico de las mediciones.
- Definir el tratamiento de la primera lectura y de correcciones, reinicios o anulaciones antes de implementar el cálculo definitivo.

> **Ejemplo:**
> 
> | Fecha | Acumulado | Lectura |
> |---|---|---|
> | 01/11/2026 | 1.000 | — (inicial) |
> | 05/11/2026 | 1.250 | 250 |
> | 10/11/2026 | 1.400 | 150 |

**Criterio de aceptación:** «Acumulado» muestra el total registrado y «Lectura» muestra únicamente la diferencia respecto de la medición anterior aplicable al mismo medidor.

### 11.3. Ordenamiento por Fecha y hora
- Habilitar el ordenamiento ascendente y descendente de la columna **Fecha y hora**.
- Conservar el orden seleccionado al actualizar la tabla y, cuando corresponda, al aplicar filtros.

**Criterio de aceptación:** El usuario puede consultar los registros desde los más antiguos a los más recientes y viceversa.

### 11.4. Acciones visuales y anulación
- Sustituir los textos de las acciones por iconos o botones identificables.
- Agregar la acción **Anular**, disponible exclusivamente para usuarios con rol Administrador.
- Solicitar confirmación antes de anular una lectura.
- Conservar el registro anulado, identificar visualmente su estado y registrar el usuario y la fecha de anulación.
- Revisar los cálculos y valores derivados que dependan de la lectura anulada para mantener la consistencia del historial.

**Criterio de aceptación:** Solo el Administrador puede anular lecturas; el registro permanece identificable y los valores dependientes se mantienen consistentes.

---

## 12. Módulo de Planes de Mantenimiento

### 12.1. Nombre automático y editable
- Al crear o editar un plan desde su modal, generar un nombre según el Activo y el Tipo de mantenimiento seleccionados.
- Aplicar la estructura: `MANTENIMIENTO + TIPO + NOMBRE DEL ACTIVO`.
- Permitir modificar manualmente el nombre generado, sin sobrescribir cambios personalizados de manera involuntaria.
- **Ejemplo:** `MANTENIMIENTO HIDRÁULICO A MOLINO DE BOLAS`.

**Criterio de aceptación:** El nombre se propone automáticamente con los datos seleccionados y permanece editable por el usuario.

### 12.2. Observación automática y editable
- Proponer una observación descriptiva a partir del activo, el tipo de mantenimiento, las reglas, las frecuencias y los criterios de vencimiento configurados.
- Actualizar la propuesta cuando cambien los datos relevantes, siempre que el usuario no haya personalizado manualmente el texto.
- Permitir editar libremente la observación antes de guardar.
- **Ejemplo:** «Plan de mantenimiento hidráulico del activo Molino de Bolas, sujeto a las reglas, frecuencias y condiciones de vencimiento establecidas en el plan».

**Criterio de aceptación:** La observación refleja los datos disponibles y conserva los cambios manuales realizados por el usuario.

### 12.3. Barra de búsqueda
- Incorporar una barra de búsqueda al listado de planes, con diseño y funcionamiento similares a los del módulo de Medidores.
- Permitir localizar planes por sus datos identificativos relevantes.
- Mantener la compatibilidad con los filtros y la persistencia de estado en la URL definidos en la primera parte.

**Criterio de aceptación:** El usuario puede buscar planes sin perder los filtros ni la vista seleccionada al recargar la página.

---

## 13. Módulo de Órdenes

### 13.1. Creación rápida de repuestos
- En el modal utilizado para completar una orden, incorporar un botón `+` junto al selector de repuestos.
- Al pulsarlo, abrir el modal de creación de repuestos sin abandonar la orden en curso.
- Al guardar correctamente el nuevo repuesto, actualizar el selector y dejar disponible el repuesto recién creado para su selección inmediata.
- Conservar los datos ya ingresados en la orden y respetar las validaciones y permisos de creación de repuestos.

**Criterio de aceptación:** El usuario puede crear un repuesto faltante y continuar completando la misma orden sin perder información.

---

## 14. Módulo de Historial

### 14.1. Ampliación de la información registrada
- Mostrar la fecha y hora, el módulo, la acción ejecutada, el registro afectado y una descripción comprensible de la operación.
- Registrar, cuando corresponda, el estado anterior y el estado posterior de los datos modificados.
- Identificar al usuario responsable mediante su nombre o código de usuario.

### 14.2. Trazabilidad de las operaciones
- Asociar cada operación relevante con el usuario autenticado que la ejecutó.
- Registrar acciones de creación, edición, eliminación, anulación y otras operaciones administrativas relevantes.
- Conservar la información necesaria para consultar posteriormente quién realizó cada acción y cuándo ocurrió.
- Presentar la información de manera organizada y fácil de consultar.

**Criterio de aceptación:** El historial permite identificar la operación realizada, el registro afectado, la fecha y hora y el usuario responsable.

---

## 15. Requisitos transversales y resultado esperado — Segunda parte
- Respetar la arquitectura, las relaciones y las reglas de negocio existentes.
- Reutilizar componentes y lógica de negocio para evitar duplicaciones.
- Aplicar los permisos tanto en la interfaz como en el servidor.
- Evitar pérdidas de información y mantener la consistencia de las lecturas y registros relacionados.
- Validar el funcionamiento de filtros, búsquedas, cálculos, ordenamientos, modales y operaciones administrativas.
- Mantener un diseño consistente y adaptable a escritorio y dispositivos móviles.

**Resultado esperado:** El sistema contará con acciones más claras, controles administrativos de eliminación y anulación, un historial de lecturas con filtros y valores diferenciados, planes con textos automáticos editables, creación rápida de repuestos y mayor trazabilidad de las operaciones realizadas por los usuarios.

---

**Nota:** Las reglas no especificadas sobre reinicios de medidores, eliminación física o lógica, y efectos de la anulación sobre cálculos posteriores deberán validarse durante el diseño e implementación.
