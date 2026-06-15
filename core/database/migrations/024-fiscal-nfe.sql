CREATE SCHEMA IF NOT EXISTS "fiscal";

CREATE TABLE IF NOT EXISTS "fiscal"."settings" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
  "dfe_provider" text DEFAULT 'dfe_kit_jacobina' NOT NULL,
  "dfe_environment" text DEFAULT 'homologation' NOT NULL,
  "dfe_api_base_url" text,
  "dfe_username" text,
  "dfe_password" text,
  "municipal_registration" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fiscal"."nfe_documents" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
  "vault_document_id" uuid REFERENCES "vault"."documents"("id") ON DELETE set null,
  "access_key" text NOT NULL,
  "number" text NOT NULL,
  "series" text NOT NULL,
  "issuer_name" text NOT NULL,
  "recipient_name" text,
  "total_amount_cents" integer DEFAULT 0 NOT NULL,
  "issued_at" timestamp with time zone,
  "status" text DEFAULT 'received' NOT NULL,
  "file_key" text,
  "original_file_name" text,
  "mime_type" text,
  "file_size" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_settings_team_id_idx" ON "fiscal"."settings" ("team_id");
CREATE UNIQUE INDEX IF NOT EXISTS "nfe_documents_team_access_key_idx" ON "fiscal"."nfe_documents" ("team_id", "access_key");
CREATE UNIQUE INDEX IF NOT EXISTS "nfe_documents_vault_document_id_idx" ON "fiscal"."nfe_documents" ("vault_document_id");
