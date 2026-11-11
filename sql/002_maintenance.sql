-- Run in public of each configured PostgreSQL connection, before loading the dataset.
-- Initial installation: intentionally fails if tables already exist.
-- No local saeact and no cross-database foreign keys.
BEGIN;
CREATE TABLE public.saeumd_mant (
 id_um BIGSERIAL PRIMARY KEY, codigo VARCHAR(10) NOT NULL UNIQUE,
 nombre VARCHAR(50) NOT NULL, tipo_control VARCHAR(20) NOT NULL CHECK(tipo_control IN ('MEDIDOR','CALENDARIO')),
 estado BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE public.saetima_mant (
 id_tima BIGSERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL, descripcion TEXT, estado BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE public.saemedi_mant (
 id_medidor BIGSERIAL PRIMARY KEY, id_activo BIGINT NOT NULL CHECK(id_activo>0),
 id_um BIGINT NOT NULL REFERENCES public.saeumd_mant(id_um), codigo VARCHAR(30) NOT NULL,
 nombre_medidor VARCHAR(100) NOT NULL, estado BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(id_activo,codigo), UNIQUE(id_medidor,id_um)
);
CREATE TABLE public.saemedt_mant (
 id_medidor BIGINT NOT NULL REFERENCES public.saemedi_mant(id_medidor),
 id_tima BIGINT NOT NULL REFERENCES public.saetima_mant(id_tima),
 estado BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(id_medidor,id_tima)
);
CREATE TABLE public.saelect_mant (
 id_lectura BIGSERIAL PRIMARY KEY, id_medidor BIGINT NOT NULL REFERENCES public.saemedi_mant(id_medidor),
 id_tima BIGINT,
 fecha_lectura TIMESTAMP NOT NULL, valor NUMERIC(14,2) NOT NULL CHECK(valor>=0), observacion TEXT,
 FOREIGN KEY(id_medidor,id_tima) REFERENCES public.saemedt_mant(id_medidor,id_tima)
);
CREATE UNIQUE INDEX ux_lectura_medidor_tipo_fecha ON public.saelect_mant(id_medidor,id_tima,fecha_lectura) WHERE id_tima IS NOT NULL;
CREATE UNIQUE INDEX ux_lectura_legacy_fecha ON public.saelect_mant(id_medidor,fecha_lectura) WHERE id_tima IS NULL;
CREATE TABLE public.saeplan_mant (
 id_plan BIGSERIAL PRIMARY KEY, id_activo BIGINT NOT NULL CHECK(id_activo>0),
 id_tima BIGINT NOT NULL REFERENCES public.saetima_mant(id_tima),
 estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO','INACTIVO')),
 nombre_plan VARCHAR(150) NOT NULL, fecha_inicio DATE NOT NULL, fecha_fin DATE, observacion TEXT,
 CHECK(fecha_fin IS NULL OR fecha_fin>=fecha_inicio)
);
CREATE TABLE public.saeregl_mant (
 id_regla BIGSERIAL PRIMARY KEY, id_plan BIGINT NOT NULL REFERENCES public.saeplan_mant(id_plan),
 id_medidor BIGINT, id_um BIGINT NOT NULL REFERENCES public.saeumd_mant(id_um),
 frecuencia NUMERIC(14,2) NOT NULL CHECK(frecuencia>0), valor_base NUMERIC(14,2) CHECK(valor_base>=0),
 alerta_antes NUMERIC(14,2) DEFAULT 0 CHECK(alerta_antes>=0),
 condicion VARCHAR(10) NOT NULL DEFAULT 'OR' CHECK(condicion IN ('OR','AND')),
 orden_eval SMALLINT NOT NULL DEFAULT 1 CHECK(orden_eval>0), estado BOOLEAN NOT NULL DEFAULT TRUE,
 FOREIGN KEY(id_medidor,id_um) REFERENCES public.saemedi_mant(id_medidor,id_um),
 CHECK(id_medidor IS NULL OR valor_base IS NOT NULL), UNIQUE(id_plan,orden_eval)
);
CREATE TABLE public.saerepu_mant (
 id_repu BIGSERIAL PRIMARY KEY, codigo VARCHAR(30) NOT NULL UNIQUE, nombre VARCHAR(150) NOT NULL,
 unidad_medida VARCHAR(20) NOT NULL, costo_referencia NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(costo_referencia>=0),
 estado BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE public.saeordm_mant (
 id_ordm BIGSERIAL PRIMARY KEY, id_plan BIGINT NOT NULL REFERENCES public.saeplan_mant(id_plan),
 fecha_programada DATE, fecha_realizada TIMESTAMP, valor_programado NUMERIC(14,2) CHECK(valor_programado>=0),
 valor_realizado NUMERIC(14,2) CHECK(valor_realizado>=0),
 estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','REALIZADA','CANCELADO')),
 observacion TEXT,
 CHECK((estado='REALIZADA' AND fecha_realizada IS NOT NULL) OR (estado<>'REALIZADA' AND fecha_realizada IS NULL))
);
CREATE TABLE public.saedetm_mant (
 id_detm BIGSERIAL PRIMARY KEY, id_ordm BIGINT NOT NULL REFERENCES public.saeordm_mant(id_ordm),
 id_repu BIGINT NOT NULL REFERENCES public.saerepu_mant(id_repu),
 cantidad NUMERIC(14,2) NOT NULL CHECK(cantidad>0), costo_unitario NUMERIC(14,2) NOT NULL CHECK(costo_unitario>=0),
 subtotal NUMERIC(14,2) NOT NULL CHECK(subtotal>=0), CHECK(subtotal=ROUND(cantidad*costo_unitario,2))
);
CREATE INDEX ix_medidor_activo ON public.saemedi_mant(id_activo);
CREATE INDEX ix_plan_activo ON public.saeplan_mant(id_activo);
CREATE INDEX ix_plan_tipo ON public.saeplan_mant(id_tima);
CREATE INDEX ix_regla_medidor ON public.saeregl_mant(id_medidor);
CREATE INDEX ix_orden_plan ON public.saeordm_mant(id_plan);
CREATE INDEX ix_detalle_orden ON public.saedetm_mant(id_ordm);
CREATE INDEX ix_detalle_repuesto ON public.saedetm_mant(id_repu);
COMMENT ON COLUMN public.saemedi_mant.id_activo IS 'Identidad global de la integración ERP existente, no es act_cod_act ni una FK local.';
COMMENT ON COLUMN public.saeplan_mant.id_activo IS 'Misma identidad global de la integración usada en saemedi_mant.';
COMMENT ON COLUMN public.saeregl_mant.valor_base IS 'Base inicial inmutable. El siguiente ciclo se calcula desde la última ejecución válida.';
COMMENT ON COLUMN public.saeregl_mant.alerta_antes IS 'MEDIDOR: unidad de la regla. CALENDARIO: días, incluso para MES.';
COMMENT ON COLUMN public.saeregl_mant.condicion IS 'Condición uniforme de todas las reglas activas: OR cualquiera, AND todas.';
COMMENT ON COLUMN public.saeordm_mant.valor_realizado IS 'Referencia de un medidor. Varios medidores requieren detalle por regla no incluido en este modelo.';
COMMIT;
