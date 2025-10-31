const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Watershed = require('./Watershed');
const SatelliteData = require('./SatelliteData');
const ChangeDetection = require('./ChangeDetection');
const ProcessingTask = require('./ProcessingTask');

// Define associations
User.hasMany(ProcessingTask, { foreignKey: 'userId', as: 'tasks' });
ProcessingTask.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Watershed.hasMany(SatelliteData, { foreignKey: 'watershedId', as: 'satelliteData' });
SatelliteData.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

Watershed.hasMany(ChangeDetection, { foreignKey: 'watershedId', as: 'changeDetections' });
ChangeDetection.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

SatelliteData.hasMany(ChangeDetection, { foreignKey: 'baselineImageId', as: 'baselineFor' });
ChangeDetection.belongsTo(SatelliteData, { foreignKey: 'baselineImageId', as: 'baselineImage' });

SatelliteData.hasMany(ChangeDetection, { foreignKey: 'comparisonImageId', as: 'comparisonFor' });
ChangeDetection.belongsTo(SatelliteData, { foreignKey: 'comparisonImageId', as: 'comparisonImage' });

Watershed.hasMany(ProcessingTask, { foreignKey: 'watershedId', as: 'tasks' });
ProcessingTask.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

const initModels = async () => {
  try {
    await sequelize.sync();
    console.log('Models synchronized successfully');
  } catch (error) {
    console.error('Error synchronizing models:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Watershed,
  SatelliteData,
  ChangeDetection,
  ProcessingTask,
  initModels
};
