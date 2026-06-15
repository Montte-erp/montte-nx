CREATE SCHEMA IF NOT EXISTS "vault";

CREATE TABLE IF NOT EXISTS "vault"."folders" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "system_key" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "vault"."documents" (
  "id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "auth"."organization"("id") ON DELETE cascade,
  "team_id" uuid NOT NULL REFERENCES "auth"."team"("id") ON DELETE cascade,
  "folder_id" uuid REFERENCES "vault"."folders"("id") ON DELETE set null,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "file_key" text,
  "original_file_name" text,
  "mime_type" text,
  "file_size" integer,
  "uploaded_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "vault_folders_team_id_idx" ON "vault"."folders" ("team_id");
CREATE UNIQUE INDEX IF NOT EXISTS "vault_folders_team_name_idx" ON "vault"."folders" ("team_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "vault_folders_team_system_key_idx" ON "vault"."folders" ("team_id", "system_key");
CREATE INDEX IF NOT EXISTS "vault_documents_team_id_idx" ON "vault"."documents" ("team_id");
CREATE INDEX IF NOT EXISTS "vault_documents_folder_id_idx" ON "vault"."documents" ("folder_id");
CREATE INDEX IF NOT EXISTS "vault_documents_status_idx" ON "vault"."documents" ("status");
CREATE INDEX IF NOT EXISTS "vault_documents_updated_at_idx" ON "vault"."documents" ("updated_at");
