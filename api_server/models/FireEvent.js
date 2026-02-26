const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FireEvent = sequelize.define('FireEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  watershedId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'watershed_id',
    references: { model: 'watersheds', key: 'id' }
  },
  detectedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'detected_at'
  },
  source: {
    type: DataTypes.ENUM('FIRMS', 'manual'),
    allowNull: false,
    defaultValue: 'FIRMS'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: false
  },
  confidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: 'FIRMS confidence value (0-100)'
  },
  frp: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Fire Radiative Power in MW'
  },
  status: {
    type: DataTypes.ENUM('detected', 'processing', 'classified', 'resolved'),
    allowNull: false,
    defaultValue: 'detected'
  },
  severityResults: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'severity_results',
    comment: 'Burn severity classification results'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Additional FIRMS data (brightness, satellite, etc.)'
  }
}, {
  tableName: 'fire_events',
  underscored: true,
  timestamps: true
});

module.exports = FireEvent;
