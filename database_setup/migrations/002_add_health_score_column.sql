-- Migration: Add health_score column to watersheds table
-- Date: 2025-10-30
-- Issue: Frontend requires healthScore field to display watersheds

BEGIN;

-- Add health_score column
ALTER TABLE watersheds
ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 75;

-- Update existing watersheds with health scores
UPDATE watersheds SET health_score = 85 WHERE code = 'AMZ_NORTH_001';
UPDATE watersheds SET health_score = 72 WHERE code = 'MS_DELTA_001';
UPDATE watersheds SET health_score = 68 WHERE code = 'YGT_BASIN_001';
UPDATE watersheds SET health_score = 55 WHERE code = 'CLR_BASIN_001';
UPDATE watersheds SET health_score = 78 WHERE code = 'RHN_VALLEY_001';
UPDATE watersheds SET health_score = 65 WHERE code = 'SAMPLE_001';

COMMIT;

-- Verify the changes
SELECT name, code, health_score FROM watersheds ORDER BY name;
