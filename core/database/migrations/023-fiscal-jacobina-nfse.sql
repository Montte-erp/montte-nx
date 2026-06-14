CREATE SCHEMA IF NOT EXISTS "fiscal";

CREATE TABLE IF NOT EXISTS "fiscal"."provider_secrets" (
   "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
   "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
   "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
   "provider_id" text NOT NULL,
   "environment" text NOT NULL,
   "issuer_tax_id" text NOT NULL,
   "municipal_registration" text NOT NULL,
   "username_ciphertext" text NOT NULL,
   "password_ciphertext" text NOT NULL,
   "encryption_version" text DEFAULT 'aes-256-gcm:v1' NOT NULL,
   "created_at" timestamp with time zone DEFAULT now() NOT NULL,
   "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_provider_secrets_team_provider_env_unique"
   ON "fiscal"."provider_secrets" ("team_id", "provider_id", "environment");

CREATE INDEX IF NOT EXISTS "fiscal_provider_secrets_team_idx"
   ON "fiscal"."provider_secrets" ("team_id");

CREATE TABLE IF NOT EXISTS "fiscal"."documents" (
   "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
   "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
   "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
   "provider_id" text NOT NULL,
   "document_kind" text DEFAULT 'nfse' NOT NULL,
   "environment" text NOT NULL,
   "issuer_tax_id" text NOT NULL,
   "series" text NOT NULL,
   "number" text NOT NULL,
   "status" text NOT NULL,
   "provider_document_id" text,
   "protocol" text,
   "verification_url" text,
   "rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
   "artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
   "created_at" timestamp with time zone DEFAULT now() NOT NULL,
   "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_team_provider_ref_unique"
   ON "fiscal"."documents" (
      "team_id",
      "provider_id",
      "environment",
      "issuer_tax_id",
      "series",
      "number"
   );

CREATE INDEX IF NOT EXISTS "fiscal_documents_team_status_idx"
   ON "fiscal"."documents" ("team_id", "status");

CREATE INDEX IF NOT EXISTS "fiscal_documents_team_created_idx"
   ON "fiscal"."documents" ("team_id", "created_at");
