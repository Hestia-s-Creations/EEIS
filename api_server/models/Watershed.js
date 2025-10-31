const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Watershed = sequelize.define('Watershed', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  area: {
    type: DataTypes.DECIMAL(15, 2), // square kilometers
    allowNull: false
  },
  centroid: {
    type: DataTypes.GEOMETRY('POINT', 4326),
    allowNull: false
  },
  boundaries: {
    type: DataTypes.GEOMETRY('MULTIPOLYGON', 4326),
    allowNull: false
  },
  riverNetwork: {
    type: DataTypes.GEOMETRY('MULTILINESTRING', 4326)
  },
  elevation: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  climateData: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  soilType: {
    type: DataTypes.ENUM('clay', 'sandy', 'loam', 'silt', 'mixed'),
    defaultValue: 'mixed'
  },
  landUse: {
    type: DataTypes.JSONB,
    defaultValue: {
      forest: 60,
      agriculture: 25,
      urban: 5,
      water: 5,
      other: 5
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'archived', 'monitoring'),
    defaultValue: 'active'
  },
  healthScore: {
    type: DataTypes.INTEGER,
    field: 'health_score',
    defaultValue: 75
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'watersheds',
  hooks: {
    beforeCreate: (watershed) => {
      // Calculate land use percentages if not provided
      const landUse = watershed.landUse || {};
      const total = Object.values(landUse).reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (total === 0) {
        // Set default values if no land use data provided
        watershed.landUse = {
          forest: 60,
          agriculture: 25,
          urban: 5,
          water: 5,
          other: 5
        };
      }
    }
  }
});

module.exports = Watershed;
