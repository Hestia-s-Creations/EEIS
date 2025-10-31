const { sequelize } = require('../config/database');
const { logger } = require('../utils/logger');

async function addHealthScoreColumn() {
  try {
    logger.info('Adding health_score column to watersheds table...');

    // Add column
    await sequelize.query('ALTER TABLE watersheds ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 75');
    logger.info('health_score column added');

    // Update existing watersheds
    await sequelize.query("UPDATE watersheds SET health_score = 85 WHERE code = 'AMZ_NORTH_001'");
    await sequelize.query("UPDATE watersheds SET health_score = 72 WHERE code = 'MS_DELTA_001'");
    await sequelize.query("UPDATE watersheds SET health_score = 68 WHERE code = 'YGT_BASIN_001'");
    await sequelize.query("UPDATE watersheds SET health_score = 55 WHERE code = 'CLR_BASIN_001'");
    await sequelize.query("UPDATE watersheds SET health_score = 78 WHERE code = 'RHN_VALLEY_001'");
    await sequelize.query("UPDATE watersheds SET health_score = 65 WHERE code = 'SAMPLE_001'");

    logger.info('Updated health scores for all watersheds');

    // Verify
    const [results] = await sequelize.query('SELECT name, code, health_score FROM watersheds ORDER BY name');
    console.log('\nWatershed Health Scores:');
    results.forEach(row => {
      console.log(`  ${row.name} (${row.code}): ${row.health_score}%`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Failed to add health_score column:', error);
    process.exit(1);
  }
}

addHealthScoreColumn();
