-- Run in EACH ERP database. The ERP owns this flag; SisMant only reads it.
-- Initial installation: fails if the column already exists. No assets are selected here.
BEGIN;
ALTER TABLE public.saeact
  ADD COLUMN act_usa_mant CHAR(1) NOT NULL DEFAULT 'N'
  CONSTRAINT ck_saeact_usa_mant CHECK (act_usa_mant IN ('S','N'));
COMMENT ON COLUMN public.saeact.act_usa_mant IS
  'S: activo incluido en mantenimiento. N: excluido. Administrado en el ERP.';
COMMIT;
