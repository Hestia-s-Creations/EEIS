const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Watershed Disturbance Mapping System API',
      version: '1.0.0',
      description: 'API for managing watershed data, satellite imagery, and change detection analysis',
      contact: {
        name: 'API Support',
        email: 'support@watershedmapping.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: process.env.PRODUCTION_API_URL || 'https://api.watershedmapping.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['username', 'email', 'password', 'firstName', 'lastName'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique identifier'
            },
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              description: 'Unique username'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              maxLength: 50,
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              maxLength: 50,
              description: 'User last name'
            },
            role: {
              type: 'string',
              enum: ['admin', 'researcher', 'analyst', 'viewer'],
              description: 'User role'
            },
            organization: {
              type: 'string',
              maxLength: 100,
              description: 'User organization'
            },
            isActive: {
              type: 'boolean',
              description: 'Account status'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            }
          }
        },
        Watershed: {
          type: 'object',
          required: ['name', 'code', 'area', 'centroid', 'boundaries'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              maxLength: 100,
              description: 'Watershed name'
            },
            code: {
              type: 'string',
              maxLength: 20,
              description: 'Unique watershed code'
            },
            description: {
              type: 'string',
              description: 'Watershed description'
            },
            area: {
              type: 'number',
              minimum: 0,
              description: 'Watershed area in square kilometers'
            },
            centroid: {
              type: 'object',
              description: 'Geographic centroid coordinates'
            },
            boundaries: {
              type: 'object',
              description: 'Watershed boundary polygon'
            },
            soilType: {
              type: 'string',
              enum: ['clay', 'sandy', 'loam', 'silt', 'mixed']
            },
            landUse: {
              type: 'object',
              properties: {
                forest: { type: 'number' },
                agriculture: { type: 'number' },
                urban: { type: 'number' },
                water: { type: 'number' },
                other: { type: 'number' }
              }
            },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'monitoring']
            }
          }
        },
        SatelliteData: {
          type: 'object',
          required: ['watershedId', 'satellite', 'sensor', 'acquisitionDate', 'cloudCover', 'sceneId'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            watershedId: {
              type: 'string',
              format: 'uuid',
              description: 'Associated watershed ID'
            },
            satellite: {
              type: 'string',
              enum: ['landsat8', 'landsat9', 'sentinel2', 'modis'],
              description: 'Satellite platform'
            },
            sensor: {
              type: 'string',
              description: 'Sensor name'
            },
            acquisitionDate: {
              type: 'string',
              format: 'date',
              description: 'Image acquisition date'
            },
            cloudCover: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Cloud cover percentage'
            },
            sceneId: {
              type: 'string',
              description: 'Unique scene identifier'
            },
            processingStatus: {
              type: 'string',
              enum: ['downloading', 'processing', 'processed', 'failed', 'archived']
            }
          }
        },
        ChangeDetection: {
          type: 'object',
          required: ['watershedId', 'name', 'baselineImageId', 'comparisonImageId', 'algorithm'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            watershedId: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              maxLength: 100
            },
            algorithm: {
              type: 'string',
              enum: [
                'ndvi_difference',
                'ndwi_difference',
                'ndbi_difference',
                'pca_change',
                'image_difference',
                'change_vector_analysis',
                'machine_learning'
              ]
            },
            processingStatus: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed']
            },
            progress: {
              type: 'integer',
              minimum: 0,
              maximum: 100
            }
          }
        },
        ProcessingTask: {
          type: 'object',
          required: ['watershedId', 'taskType', 'taskName'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            watershedId: {
              type: 'string',
              format: 'uuid'
            },
            userId: {
              type: 'string',
              format: 'uuid'
            },
            taskType: {
              type: 'string',
              enum: [
                'satellite_download',
                'image_preprocessing',
                'change_detection',
                'classification',
                'analysis',
                'export'
              ]
            },
            taskName: {
              type: 'string',
              maxLength: 100
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
            },
            progress: {
              type: 'integer',
              minimum: 0,
              maximum: 100
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high', 'urgent']
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './models/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
