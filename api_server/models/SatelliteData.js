const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SatelliteData = sequelize.define('SatelliteData', {
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
  satellite: {
    type: DataTypes.ENUM('landsat8', 'landsat9', 'sentinel2', 'modis'),
    allowNull: false
  },
  sensor: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  acquisitionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  processingDate: {
    type: DataTypes.DATE
  },
  cloudCover: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  sceneId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  path: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  row: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cornerCoordinates: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  footprint: {
    type: DataTypes.GEOMETRY('POLYGON', 4326),
    allowNull: false
  },
  bands: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  filePaths: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  fileSizes: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  processingStatus: {
    type: DataTypes.ENUM('downloading', 'processing', 'processed', 'failed', 'archived'),
    defaultValue: 'downloading'
  },
  qualityFlags: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  downloadUrl: {
    type: DataTypes.STRING(500)
  },
  productType: {
    type: DataTypes.STRING(50)
  },
  sunElevation: {
    type: DataTypes.DECIMAL(8, 4)
  },
  sunAzimuth: {
    type: DataTypes.DECIMAL(8, 4)
  }
}, {
  tableName: 'satellite_data'
});

module.exports = SatelliteData;
