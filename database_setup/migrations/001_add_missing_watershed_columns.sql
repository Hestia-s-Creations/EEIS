-- Migration: Add missing columns to watersheds table
-- Date: 2025-10-30
-- Issue: Database schema mismatch causing API crashes

BEGIN;

-- Add missing geometry column for river network
ALTER TABLE watersheds
ADD COLUMN IF NOT EXISTS river_network geometry(MULTILINESTRING, 4326);

-- Add missing JSONB columns
ALTER TABLE watersheds
ADD COLUMN IF NOT EXISTS elevation JSONB DEFAULT '{}';

ALTER TABLE watersheds
ADD COLUMN IF NOT EXISTS climate_data JSONB DEFAULT '{}';

ALTER TABLE watersheds
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create indexes for JSONB columns (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_watersheds_elevation ON watersheds USING GIN (elevation);
CREATE INDEX IF NOT EXISTS idx_watersheds_climate_data ON watersheds USING GIN (climate_data);
CREATE INDEX IF NOT EXISTS idx_watersheds_metadata ON watersheds USING GIN (metadata);

-- Create spatial index for river network
CREATE INDEX IF NOT EXISTS idx_watersheds_river_network ON watersheds USING GIST (river_network);

COMMIT;

-- Verify the changes
\d watersheds
