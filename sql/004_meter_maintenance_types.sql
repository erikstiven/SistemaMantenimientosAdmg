-- PostgreSQL. Revisado contra minesadco_copia06_11_2026 el 10/11/2026.
-- Ejecutar en la base que contiene las tablas de mantenimiento.
-- Conserva las lecturas sin clasificación inequívoca con id_tima NULL.
BEGIN;
SET LOCAL lock_timeout = '15s';
DO $$
BEGIN
  IF to_regclass('public.saemedi_mant') IS NULL
    OR to_regclass('public.saelect_mant') IS NULL
    OR to_regclass('public.saetima_mant') IS NULL
    OR to_regclass('public.saeplan_mant') IS NULL
    OR to_regclass('public.saeregl_mant') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas de mantenimiento. Este script requiere la instalación existente.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='saelect_mant'
      AND column_name='id_tima' AND data_type <> 'bigint'
  ) THEN
    RAISE EXCEPTION 'saelect_mant.id_tima ya existe con otro tipo. Revisar antes de continuar.';
  END IF;
END $$;
LOCK TABLE public.saemedi_mant,public.saelect_mant,public.saeplan_mant,public.saeregl_mant IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS sismant;
CREATE TABLE IF NOT EXISTS sismant.maintenance_migrations (
 version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.saemedt_mant (
 id_medidor BIGINT NOT NULL REFERENCES public.saemedi_mant(id_medidor),
 id_tima BIGINT NOT NULL REFERENCES public.saetima_mant(id_tima),
 estado BOOLEAN NOT NULL DEFAULT TRUE,
 PRIMARY KEY(id_medidor,id_tima)
);
ALTER TABLE public.saelect_mant ADD COLUMN IF NOT EXISTS id_tima BIGINT;
DO $$
DECLARE item RECORD;
BEGIN
  -- Elimina solo la unicidad antigua del par medidor/fecha, cualquiera que sea su nombre.
  FOR item IN
    SELECT con.conname FROM pg_constraint con
    WHERE con.conrelid='public.saelect_mant'::regclass AND con.contype='u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(con.conkey) k JOIN pg_attribute a
             ON a.attrelid=con.conrelid AND a.attnum=k)
          = ARRAY['fecha_lectura','id_medidor']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.saelect_mant DROP CONSTRAINT %I',item.conname);
  END LOOP;
  FOR item IN
    SELECT i.indexrelid::regclass AS index_name FROM pg_index i
    WHERE i.indrelid='public.saelect_mant'::regclass AND i.indisunique
      AND i.indpred IS NULL AND i.indexprs IS NULL
      AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(i.indkey::smallint[]) k JOIN pg_attribute a
             ON a.attrelid=i.indrelid AND a.attnum=k)
          = ARRAY['fecha_lectura','id_medidor']::text[]
  LOOP
    EXECUTE format('DROP INDEX %s',item.index_name);
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM sismant.maintenance_migrations WHERE version='004_meter_maintenance_types') THEN
    INSERT INTO public.saemedt_mant(id_medidor,id_tima)
      SELECT DISTINCT r.id_medidor,p.id_tima
      FROM public.saeregl_mant r JOIN public.saeplan_mant p ON p.id_plan=r.id_plan
      WHERE r.id_medidor IS NOT NULL
      ON CONFLICT(id_medidor,id_tima) DO NOTHING;
    UPDATE public.saelect_mant l SET id_tima=single_type.id_tima
    FROM (
      SELECT r.id_medidor,MIN(p.id_tima) AS id_tima
      FROM public.saeregl_mant r JOIN public.saeplan_mant p ON p.id_plan=r.id_plan
      WHERE r.id_medidor IS NOT NULL
      GROUP BY r.id_medidor HAVING COUNT(DISTINCT p.id_tima)=1
    ) single_type WHERE l.id_medidor=single_type.id_medidor AND l.id_tima IS NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.saelect_mant'::regclass
      AND c.contype='f' AND c.confrelid='public.saemedt_mant'::regclass
      AND c.conkey=ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id_medidor'),
        (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id_tima')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.saelect_mant ADD CONSTRAINT fk_lectura_medidor_tipo
      FOREIGN KEY(id_medidor,id_tima) REFERENCES public.saemedt_mant(id_medidor,id_tima);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS ux_lectura_medidor_tipo_fecha
  ON public.saelect_mant(id_medidor,id_tima,fecha_lectura) WHERE id_tima IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_lectura_legacy_fecha
  ON public.saelect_mant(id_medidor,fecha_lectura) WHERE id_tima IS NULL;
INSERT INTO sismant.maintenance_migrations(version) VALUES('004_meter_maintenance_types') ON CONFLICT DO NOTHING;
COMMIT;
-- Revisión posterior: estos registros se conservan hasta que se pueda determinar su tipo.
SELECT id_medidor,COUNT(*) AS lecturas_sin_tipo
FROM public.saelect_mant WHERE id_tima IS NULL GROUP BY id_medidor ORDER BY id_medidor;
