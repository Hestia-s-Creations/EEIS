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
    references: {
      model: 'Watersheds',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  baselineImageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'SatelliteData',
      key: 'id'
    }
  },
  comparisonImageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'SatelliteData',
      key: 'id'
    }
  },
  baselineDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  comparisonDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  algorithm: {
    type: DataTypes.ENUM(
      'ndvi_difference',
      'ndwi_difference',
      'ndbi_difference',
      'pca_change',
      'image_difference',
      'change_vector_analysis',
      'machine_learning'
    ),
    allowNull: false
  },
  thresholds: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  processingParameters: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  resultData: {
    type: DataTypes.JSONB
  },
  statistics: {
    type: DataTypes.JSONB,
    defaultValue: {
      totalArea: 0,
      changedArea: 0,
      unchangedArea: 0,
      changePercentage: 0,
      magnitude: {
        min: 0,
        max: 0,
        mean: 0,
        std: 0
      }
    }
  },
  classifiedChanges: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  confidenceScores: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  visualizationUrl: {
    type: DataTypes.STRING(500)
  },
  resultFilePath: {
    type: DataTypes.STRING(500)
  },
  processingStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.UUID,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  processingStartedAt: {
    type: DataTypes.DATE
  },
  processingCompletedAt: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'change_detections'
});

module.exports = ChangeDetection;
