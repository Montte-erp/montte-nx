-- Migration: Goals-Tags Integration
-- This migration refactors the financial_goal table to be tag-based
--
-- Changes:
-- 1. Add progress_calculation_type enum and column
-- 2. Add tag_id column (initially nullable)
-- 3. Create tags for existing goals that don't have linked tags
-- 4. Make tag_id NOT NULL and UNIQUE
-- 5. Drop removed columns (type, current_amount, is_auto_tracked)

-- Step 1: Create the new enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_calculation_type') THEN
        CREATE TYPE progress_calculation_type AS ENUM ('income', 'expense', 'net');
    END IF;
END$$;

-- Step 2: Add new columns (nullable initially)
ALTER TABLE financial_goal
ADD COLUMN IF NOT EXISTS tag_id UUID,
ADD COLUMN IF NOT EXISTS progress_calculation_type progress_calculation_type DEFAULT 'income';

-- Step 3: Migrate existing goals
-- For each goal without a tag_id:
--   a) If it has linkedTagIds in metadata, use the first one
--   b) Otherwise, create a new tag with the goal's name

-- First, handle goals that have linkedTagIds in metadata
UPDATE financial_goal g
SET tag_id = (g.metadata->>'linkedTagIds')::jsonb->>0::text::uuid
WHERE g.tag_id IS NULL
  AND g.metadata IS NOT NULL
  AND g.metadata->>'linkedTagIds' IS NOT NULL
  AND jsonb_array_length((g.metadata->>'linkedTagIds')::jsonb) > 0
  AND EXISTS (
    SELECT 1 FROM tag t
    WHERE t.id = ((g.metadata->>'linkedTagIds')::jsonb->>0)::uuid
  );

-- For remaining goals, create new tags
-- This uses a DO block to iterate and create tags
DO $$
DECLARE
    goal_record RECORD;
    new_tag_id UUID;
    colors TEXT[] := ARRAY['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
    color_index INT := 0;
BEGIN
    FOR goal_record IN
        SELECT id, name, organization_id
        FROM financial_goal
        WHERE tag_id IS NULL
    LOOP
        new_tag_id := gen_random_uuid();

        -- Create a new tag for this goal
        INSERT INTO tag (id, organization_id, name, color, created_at, updated_at)
        VALUES (
            new_tag_id,
            goal_record.organization_id,
            goal_record.name || ' (Meta)',
            colors[(color_index % array_length(colors, 1)) + 1],
            NOW(),
            NOW()
        );

        -- Update the goal with the new tag_id
        UPDATE financial_goal
        SET tag_id = new_tag_id
        WHERE id = goal_record.id;

        color_index := color_index + 1;
    END LOOP;
END$$;

-- Step 4: Map old type to progress_calculation_type
UPDATE financial_goal
SET progress_calculation_type = CASE
    WHEN type = 'savings' THEN 'income'::progress_calculation_type
    WHEN type = 'income_target' THEN 'income'::progress_calculation_type
    WHEN type = 'debt_payoff' THEN 'expense'::progress_calculation_type
    WHEN type = 'spending_limit' THEN 'expense'::progress_calculation_type
    ELSE 'income'::progress_calculation_type
END
WHERE progress_calculation_type IS NULL OR progress_calculation_type = 'income';

-- Step 5: Add constraints now that all rows have tag_id
ALTER TABLE financial_goal
ALTER COLUMN tag_id SET NOT NULL;

-- Add unique constraint and foreign key
ALTER TABLE financial_goal
ADD CONSTRAINT uq_goal_tag UNIQUE (tag_id);

ALTER TABLE financial_goal
ADD CONSTRAINT fk_goal_tag FOREIGN KEY (tag_id)
REFERENCES tag(id) ON DELETE RESTRICT;

-- Step 6: Create index for tag_id
CREATE INDEX IF NOT EXISTS idx_goal_tag ON financial_goal(tag_id);

-- Step 7: Drop the old columns and indexes
-- Note: Run these after verifying the migration was successful
-- You may want to comment these out initially and run them separately

-- Drop old index
DROP INDEX IF EXISTS idx_goal_type;

-- Drop old columns
ALTER TABLE financial_goal
DROP COLUMN IF EXISTS type,
DROP COLUMN IF EXISTS current_amount,
DROP COLUMN IF EXISTS is_auto_tracked;

-- Drop old enum (if no longer needed elsewhere)
-- DROP TYPE IF EXISTS goal_type;

-- Step 8: Clean up metadata - remove linkedTagIds since we now have a direct relation
UPDATE financial_goal
SET metadata = metadata - 'linkedTagIds'
WHERE metadata IS NOT NULL AND metadata ? 'linkedTagIds';

-- Migration complete!
-- Verify: SELECT id, name, tag_id, progress_calculation_type FROM financial_goal;
