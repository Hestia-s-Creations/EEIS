const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChangeDetection = sequelize.define('ChangeDetection', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  watershedId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'watershed_id',
    references: {
      model: 'Watersheds',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  baselineImageId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'baseline_image_id',
    references: {
      model: 'SatelliteData',
      key: 'id'
    }
  },
  comparisonImageId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'comparison_image_id',
    references: {
      model: 'SatelliteData',
      key: 'id'
    }
  },
  algorithm: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  confidenceScore: {
    type: DataTypes.DECIMAL,
    field: 'confidence_score'
  },
  status: {
    type: DataTypes.STRING(255)
  },
  resultPath: {
    type: DataTypes.STRING(500),
    field: 'result_path'
  },
  processingLog: {
    type: DataTypes.TEXT,
    field: 'processing_log'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  createdBy: {
    type: DataTypes.UUID,
    field: 'created_by',
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'change_detections',
  underscored: true,
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ChangeDetection;
