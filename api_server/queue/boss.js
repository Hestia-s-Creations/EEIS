const PgBoss = require('pg-boss');
const { logger } = require('../utils/logger');

let boss = null;

const initBoss = async () => {
  const connectionString = `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'watershed_mapping'}`;

  boss = new PgBoss({
    connectionString,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 86400, // 1 day
    deleteAfterDays: 7,
    monitorStateIntervalSeconds: 30
  });

  boss.on('error', (error) => {
    logger.error('pg-boss error:', error);
  });

  boss.on('monitor-states', (states) => {
    logger.debug('pg-boss states:', JSON.stringify(states));
  });

  await boss.start();
  logger.info('pg-boss job queue started');

  return boss;
};

const getBoss = () => {
  if (!boss) {
    throw new Error('pg-boss not initialized. Call initBoss() first.');
  }
  return boss;
};

const stopBoss = async () => {
  if (boss) {
    await boss.stop();
    logger.info('pg-boss stopped');
  }
};

module.exports = { initBoss, getBoss, stopBoss };
