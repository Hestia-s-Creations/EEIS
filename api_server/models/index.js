const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Watershed = require('./Watershed');
const SatelliteData = require('./SatelliteData');
const ChangeDetection = require('./ChangeDetection');
const ProcessingTask = require('./ProcessingTask');
const AlertRule = require('./AlertRule');
const Alert = require('./Alert');
const Report = require('./Report');
const Notification = require('./Notification');
const UserSettings = require('./UserSettings');
const FireEvent = require('./FireEvent');

// === Existing associations ===

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

// === New associations ===

// AlertRule associations
User.hasMany(AlertRule, { foreignKey: 'userId', as: 'alertRules' });
AlertRule.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Watershed.hasMany(AlertRule, { foreignKey: 'watershedId', as: 'alertRules' });
AlertRule.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

AlertRule.hasMany(Alert, { foreignKey: 'alertRuleId', as: 'alerts' });
Alert.belongsTo(AlertRule, { foreignKey: 'alertRuleId', as: 'alertRule' });

// Alert associations
Watershed.hasMany(Alert, { foreignKey: 'watershedId', as: 'alerts' });
Alert.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

User.hasMany(Alert, { foreignKey: 'acknowledgedBy', as: 'acknowledgedAlerts' });
User.hasMany(Alert, { foreignKey: 'resolvedBy', as: 'resolvedAlerts' });

// Report associations
User.hasMany(Report, { foreignKey: 'userId', as: 'reports' });
Report.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Notification associations
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// UserSettings associations
User.hasOne(UserSettings, { foreignKey: 'userId', as: 'settings' });
UserSettings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// FireEvent associations
Watershed.hasMany(FireEvent, { foreignKey: 'watershedId', as: 'fireEvents' });
FireEvent.belongsTo(Watershed, { foreignKey: 'watershedId', as: 'watershed' });

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
  AlertRule,
  Alert,
  Report,
  Notification,
  UserSettings,
  FireEvent,
  initModels
};
