ALTER TABLE IF EXISTS "fiscal"."nfe_documents"
  ADD COLUMN IF NOT EXISTS "supplier_id" uuid REFERENCES "relationships"."parties"("id");
