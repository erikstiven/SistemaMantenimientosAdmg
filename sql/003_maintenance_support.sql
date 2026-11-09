-- Safe to repeat; run in each configured database after 002 or an existing equivalent dataset.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sismant;
CREATE SEQUENCE IF NOT EXISTS sismant.asset_identity_seq;
CREATE TABLE IF NOT EXISTS sismant.asset_identity (
 global_id BIGINT PRIMARY KEY CHECK(global_id>0),
 local_id BIGINT NOT NULL UNIQUE CHECK(local_id>0 AND local_id<4398046511104),
 namespace INTEGER NOT NULL CHECK(namespace>0 AND namespace<=2097151),
 connection_id TEXT NOT NULL, empresa_id BIGINT NOT NULL, sucursal_id BIGINT NOT NULL,
 act_cod_act BIGINT NOT NULL,
 UNIQUE(connection_id,empresa_id,sucursal_id,act_cod_act)
);
CREATE TABLE IF NOT EXISTS sismant.maintenance_revision (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO sismant.maintenance_revision(id,revision) VALUES(1,0) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS sismant.maintenance_audit (
 id BIGSERIAL PRIMARY KEY, connection_id TEXT NOT NULL, user_id BIGINT NOT NULL,
 company_id BIGINT NOT NULL, branch_id BIGINT NOT NULL, revision INTEGER NOT NULL,
 operation TEXT NOT NULL, entity_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_maintenance_audit_revision ON sismant.maintenance_audit(revision);
COMMIT;
