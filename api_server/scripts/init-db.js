const { sequelize, initModels } = require('../models');
const { logger } = require('../utils/logger');

/**
 * Initialize database connection and sync models
 */
const initializeDatabase = async () => {
  try {
    logger.info('Initializing database connection...');
    
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Initialize and sync models
    await initModels();
    logger.info('Database models synchronized successfully');
    
    logger.info('Database initialization completed');
    return true;
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

/**
 * Reset database (DROP and CREATE all tables)
 * WARNING: This will delete all data!
 */
const resetDatabase = async () => {
  try {
    logger.warn('Resetting database - all data will be lost!');
    
    await sequelize.drop();
    await sequelize.sync({ force: true });
    
    logger.info('Database reset completed');
  } catch (error) {
    logger.error('Database reset failed:', error);
    throw error;
  }
};

/**
 * Create initial admin user
 */
const createAdminUser = async () => {
  try {
    const { User } = require('../models');
    
    const existingAdmin = await User.findOne({ where: { role: 'admin' } });
    if (existingAdmin) {
      logger.info('Admin user already exists');
      return existingAdmin;
    }
    
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@watershedmapping.com',
      password: 'AdminPassword123!',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'admin',
      organization: 'Watershed Mapping System',
      isActive: true
    });
    
    logger.info('Admin user created successfully');
    logger.warn('Please change the default admin password!');
    
    return adminUser;
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    throw error;
  }
};

/**
 * Seed database with sample data
 */
const seedDatabase = async () => {
  try {
    logger.info('Seeding database with sample data...');

    const { User, Watershed, SatelliteData, ChangeDetection, ProcessingTask } = require('../models');

    // Create sample users (skip if they already exist)
    let users = [];
    try {
      users = await User.bulkCreate([
        {
          username: 'researcher1',
          email: 'researcher1@example.com',
          password: 'Researcher123!',
          firstName: 'Jane',
          lastName: 'Researcher',
          role: 'researcher',
          organization: 'Environmental Institute'
        },
        {
          username: 'analyst1',
          email: 'analyst1@example.com',
          password: 'Analyst123!',
          firstName: 'John',
          lastName: 'Analyst',
          role: 'analyst',
          organization: 'Data Analysis Corp'
        },
        {
          username: 'viewer1',
          email: 'viewer1@example.com',
          password: 'Viewer123!',
          firstName: 'Bob',
          lastName: 'Viewer',
          role: 'viewer',
          organization: 'Government Agency'
        }
      ], { ignoreDuplicates: true });
      logger.info(`Created ${users.length} new users`);
    } catch (error) {
      logger.info('Users already exist, skipping user creation');
    }
    
    // Create sample watersheds with proper geometries
    const watersheds = await Watershed.bulkCreate([
      {
        name: 'Amazon Basin North',
        code: 'AMZ_NORTH_001',
        description: 'Northern region of the Amazon River basin with dense rainforest coverage',
        area: 12500.75,
        centroid: {
          type: 'Point',
          coordinates: [-62.2159, -3.4653]
        },
        boundaries: {
          type: 'Polygon',
          coordinates: [[
            [-62.5, -3.2],
            [-62.0, -3.2],
            [-62.0, -3.7],
            [-62.5, -3.7],
            [-62.5, -3.2]
          ]]
        },
        soilType: 'mixed',
        landUse: {
          forest: 85.5,
          agriculture: 10.2,
          urban: 1.1,
          water: 2.0,
          other: 1.2
        },
        status: 'active',
        healthScore: 85,
        elevation: {
          min: 50,
          max: 500,
          average: 200
        },
        climateData: {
          avgTemperature: 26.5,
          avgRainfall: 2300,
          humidity: 85
        }
      },
      {
        name: 'Mississippi Delta',
        code: 'MS_DELTA_001',
        description: 'Mississippi River delta region with agricultural and wetland areas',
        area: 8750.30,
        centroid: {
          type: 'Point',
          coordinates: [-89.2540, 29.2308]
        },
        boundaries: {
          type: 'Polygon',
          coordinates: [[
            [-89.5, 29.0],
            [-89.0, 29.0],
            [-89.0, 29.5],
            [-89.5, 29.5],
            [-89.5, 29.0]
          ]]
        },
        soilType: 'clay',
        landUse: {
          forest: 25.3,
          agriculture: 65.7,
          urban: 4.2,
          water: 3.8,
          other: 1.0
        },
        status: 'active',
        elevation: {
          min: 0,
          max: 50,
          average: 10
        },
        climateData: {
          avgTemperature: 20.5,
          avgRainfall: 1500,
          humidity: 75
        }
      },
      {
        name: 'Yangtze River Basin',
        code: 'YGT_BASIN_001',
        description: 'Yangtze River watershed including urban and agricultural areas',
        area: 15800.45,
        centroid: {
          type: 'Point',
          coordinates: [111.3968, 30.5928]
        },
        boundaries: {
          type: 'Polygon',
          coordinates: [[
            [111.0, 30.3],
            [111.8, 30.3],
            [111.8, 30.9],
            [111.0, 30.9],
            [111.0, 30.3]
          ]]
        },
        soilType: 'loam',
        landUse: {
          forest: 45.8,
          agriculture: 35.2,
          urban: 12.5,
          water: 4.0,
          other: 2.5
        },
        status: 'active',
        elevation: {
          min: 100,
          max: 2000,
          average: 800
        },
        climateData: {
          avgTemperature: 17.5,
          avgRainfall: 1100,
          humidity: 70
        }
      },
      {
        name: 'Colorado River Basin',
        code: 'CLR_BASIN_001',
        description: 'Colorado River watershed in southwestern United States',
        area: 9500.20,
        centroid: {
          type: 'Point',
          coordinates: [-111.0937, 36.8665]
        },
        boundaries: {
          type: 'Polygon',
          coordinates: [[
            [-111.5, 36.5],
            [-110.7, 36.5],
            [-110.7, 37.2],
            [-111.5, 37.2],
            [-111.5, 36.5]
          ]]
        },
        soilType: 'sandy',
        landUse: {
          forest: 35.0,
          agriculture: 15.0,
          urban: 8.0,
          water: 5.0,
          other: 37.0
        },
        status: 'active',
        elevation: {
          min: 300,
          max: 2500,
          average: 1200
        },
        climateData: {
          avgTemperature: 15.0,
          avgRainfall: 400,
          humidity: 45
        }
      },
      {
        name: 'Rhine River Valley',
        code: 'RHN_VALLEY_001',
        description: 'Rhine River valley with mixed urban and agricultural land use',
        area: 7200.80,
        centroid: {
          type: 'Point',
          coordinates: [7.6261, 51.9607]
        },
        boundaries: {
          type: 'Polygon',
          coordinates: [[
            [7.3, 51.7],
            [7.9, 51.7],
            [7.9, 52.2],
            [7.3, 52.2],
            [7.3, 51.7]
          ]]
        },
        soilType: 'loam',
        landUse: {
          forest: 30.0,
          agriculture: 50.0,
          urban: 15.0,
          water: 3.0,
          other: 2.0
        },
        status: 'monitoring',
        elevation: {
          min: 50,
          max: 400,
          average: 180
        },
        climateData: {
          avgTemperature: 10.5,
          avgRainfall: 800,
          humidity: 80
        }
      }
    ]);
    
    logger.info(`Created ${watersheds.length} watersheds`);
    logger.info('Sample data seeding completed');
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
};

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      initializeDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error('Initialization failed:', error);
          process.exit(1);
        });
      break;
      
    case 'reset':
      resetDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error('Reset failed:', error);
          process.exit(1);
        });
      break;
      
    case 'seed':
      seedDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error('Seeding failed:', error);
          process.exit(1);
        });
      break;
      
    case 'admin':
      createAdminUser()
        .then(() => process.exit(0))
        .catch((error) => {
          logger.error('Admin creation failed:', error);
          process.exit(1);
        });
      break;
      
    case 'all':
      initializeDatabase()
        .then(() => createAdminUser())
        .then(() => seedDatabase())
        .then(() => {
          logger.info('Complete database setup finished');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Setup failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log(`
Usage: node scripts/init-db.js [command]

Commands:
  init    - Initialize database connection and sync models
  reset   - Drop and recreate all tables (WARNING: deletes all data)
  seed    - Add sample data to database
  admin   - Create initial admin user
  all     - Run init, admin, and seed commands

Examples:
  node scripts/init-db.js init
  node scripts/init-db.js all
      `);
      process.exit(1);
  }
}

module.exports = {
  initializeDatabase,
  resetDatabase,
  createAdminUser,
  seedDatabase
};
