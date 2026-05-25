CREATE SCHEMA IF NOT EXISTS "relationships";

DO $$
BEGIN
   CREATE TYPE "relationships"."party_role" AS ENUM ('customer', 'supplier');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
   CREATE TYPE "relationships"."party_kind" AS ENUM ('person', 'company');
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "relationships"."parties" (
   "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
   "team_id" uuid NOT NULL,
   "role" "relationships"."party_role" NOT NULL,
   "kind" "relationships"."party_kind" NOT NULL,
   "name" text NOT NULL,
   "document_number" text,
   "email" text,
   "phone" text,
   "archived_at" timestamp with time zone,
   "created_at" timestamp with time zone NOT NULL DEFAULT now(),
   "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "parties_team_id_idx"
   ON "relationships"."parties" ("team_id");

CREATE INDEX IF NOT EXISTS "parties_role_idx"
   ON "relationships"."parties" ("role");

CREATE INDEX IF NOT EXISTS "parties_archived_at_idx"
   ON "relationships"."parties" ("archived_at");

CREATE UNIQUE INDEX IF NOT EXISTS "parties_team_id_role_document_number_uq"
   ON "relationships"."parties" ("team_id", "role", "document_number")
   WHERE "document_number" IS NOT NULL;

ALTER TABLE "finance"."transactions"
   ADD COLUMN IF NOT EXISTS "relationship_id" uuid;

DO $$
BEGIN
   ALTER TABLE "finance"."transactions"
      ADD CONSTRAINT "transactions_relationship_id_parties_id_fk"
      FOREIGN KEY ("relationship_id")
      REFERENCES "relationships"."parties"("id")
      ON DELETE SET NULL;
EXCEPTION
   WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "transactions_relationship_id_idx"
   ON "finance"."transactions" ("relationship_id");
