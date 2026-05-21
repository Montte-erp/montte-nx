DO $$
BEGIN
   CREATE TYPE "platform"."report_source" AS ENUM ('manual', 'workflow');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
   CREATE TYPE "platform"."workflow_status" AS ENUM ('active', 'paused');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
   CREATE TYPE "platform"."workflow_run_status" AS ENUM ('pending', 'running', 'succeeded', 'failed');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
   CREATE TYPE "platform"."workflow_run_triggered_by" AS ENUM ('schedule', 'manual');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "platform"."reports"
   ADD COLUMN IF NOT EXISTS "source" "platform"."report_source" NOT NULL DEFAULT 'manual';

UPDATE "platform"."reports"
   SET "source" = 'manual'
 WHERE "source" IS NULL;

CREATE TABLE IF NOT EXISTS "platform"."workflows" (
   "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
   "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE CASCADE,
   "template_id" text NOT NULL,
   "name" text NOT NULL,
   "status" "platform"."workflow_status" NOT NULL DEFAULT 'active',
   "graph" jsonb NOT NULL,
   "next_run_at" timestamp with time zone,
   "created_by" uuid NOT NULL REFERENCES "auth"."user"("id"),
   "created_at" timestamp with time zone NOT NULL DEFAULT now(),
   "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workflows_team_id_status_idx"
   ON "platform"."workflows" ("team_id", "status");

CREATE INDEX IF NOT EXISTS "workflows_next_run_at_idx"
   ON "platform"."workflows" ("next_run_at");

CREATE TABLE IF NOT EXISTS "platform"."workflow_runs" (
   "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
   "workflow_id" uuid NOT NULL REFERENCES "platform"."workflows"("id") ON DELETE CASCADE,
   "status" "platform"."workflow_run_status" NOT NULL,
   "scheduled_for" timestamp with time zone NOT NULL,
   "started_at" timestamp with time zone,
   "ended_at" timestamp with time zone,
   "report_id" uuid REFERENCES "platform"."reports"("id"),
   "idempotency_key" text NOT NULL,
   "error" text,
   "triggered_by" "platform"."workflow_run_triggered_by" NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_runs_workflow_id_scheduled_for_idempotency_key_uq"
   ON "platform"."workflow_runs" ("workflow_id", "scheduled_for", "idempotency_key");

CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_id_status_idx"
   ON "platform"."workflow_runs" ("workflow_id", "status");

CREATE INDEX IF NOT EXISTS "workflow_runs_scheduled_for_status_idx"
   ON "platform"."workflow_runs" ("scheduled_for", "status");
