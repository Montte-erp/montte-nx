-- Remoção do resíduo de contatos
ALTER TABLE finance.transactions
   DROP COLUMN IF EXISTS contact_id;

ALTER TABLE platform.usage_events
   DROP COLUMN IF EXISTS contact_id;

DROP TABLE IF EXISTS crm.contacts CASCADE;

DROP TYPE IF EXISTS crm.contact_type;
DROP TYPE IF EXISTS crm.contact_document_type;
DROP TYPE IF EXISTS crm.service_source;
