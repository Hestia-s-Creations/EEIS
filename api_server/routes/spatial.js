const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Watershed, SatelliteData, ChangeDetection } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/spatial');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/json',
      'application/geo+json',
      'application/shapefile+zip',
      'application/zip',
      'text/csv',
      'application/vnd.ms-excel'
    ];
    
    const allowedExtensions = ['.json', '.geojson', '.zip', '.csv', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported formats: JSON, GeoJSON, Shapefile (ZIP), CSV'), false);
    }
  }
});

// @route   POST /api/spatial/upload
// @desc    Upload spatial data file
// @access  Private (Admin, Researcher)
router.post('/upload', authenticate, authorize('admin', 'researcher'), upload.single('spatialData'), catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const { watershedId, dataType = 'boundaries', metadata = {} } = req.body;

  if (!watershedId) {
    throw new AppError('Watershed ID is required', 400);
  }

  // Verify watershed exists
  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  const uploadedFile = {
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path,
    watershedId,
    dataType,
    uploadedBy: req.user.id,
    uploadedAt: new Date(),
    metadata: {
      ...metadata,
      originalSize: req.file.size,
      clientInfo: {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    }
  };

  logger.info(`Spatial data uploaded: ${req.file.originalname} (${req.file.filename})`);

  res.json({
    status: 'success',
    message: 'Spatial data uploaded successfully',
    data: {
      file: uploadedFile
    }
  });
}));

// @route   POST /api/spatial/validate
// @desc    Validate spatial data file
// @access  Private (Admin, Researcher)
router.post('/validate', authenticate, authorize('admin', 'researcher'), upload.single('spatialData'), catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const validationResults = {
    isValid: true,
    errors: [],
    warnings: [],
    properties: {}
  };

  try {
    switch (fileExtension) {
      case '.json':
      case '.geojson':
        const geojsonContent = await fs.readFile(req.file.path, 'utf8');
        const geojsonData = JSON.parse(geojsonContent);
        
        // Basic GeoJSON validation
        if (!geojsonData.type) {
          validationResults.errors.push('Missing GeoJSON type');
          validationResults.isValid = false;
        }
        
        if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
          validationResults.errors.push('Missing or invalid features array');
          validationResults.isValid = false;
        }
        
        validationResults.properties = {
          type: geojsonData.type,
          featureCount: geojsonData.features ? geojsonData.features.length : 0,
          bbox: geojsonData.bbox,
          crs: geojsonData.crs
        };
        break;

      case '.csv':
        // Basic CSV validation - would use actual CSV parsing in production
        const csvContent = await fs.readFile(req.file.path, 'utf8');
        const lines = csvContent.split('\n');
        validationResults.properties = {
          lineCount: lines.length,
          hasHeader: lines.length > 0 && lines[0].includes(',')
        };
        break;

      case '.zip':
        validationResults.properties = {
          fileType: 'Archive',
          needsExtraction: true
        };
        break;

      default:
        validationResults.warnings.push('Unknown file type - manual validation recommended');
    }

  } catch (error) {
    validationResults.errors.push(`File parsing error: ${error.message}`);
    validationResults.isValid = false;
  }

  res.json({
    status: 'success',
    data: {
      validation: validationResults,
      fileInfo: {
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype
      }
    }
  });
}));

// @route   POST /api/spatial/process
// @desc    Process uploaded spatial data
// @access  Private (Admin, Researcher)
router.post('/process', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const { filePath, watershedId, operation, parameters = {} } = req.body;

  if (!filePath || !watershedId || !operation) {
    throw new AppError('File path, watershed ID, and operation are required', 400);
  }

  // Verify watershed exists
  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // Process based on operation type
  let processingResult = {};
  
  try {
    switch (operation) {
      case 'extract_boundaries':
        // Extract watershed boundaries from uploaded file
        processingResult = await extractBoundaries(filePath, watershedId, parameters);
        break;
        
      case 'update_centroid':
        // Update watershed centroid
        processingResult = await updateCentroid(filePath, watershedId, parameters);
        break;
        
      case 'validate_coverage':
        // Validate spatial coverage
        processingResult = await validateCoverage(filePath, watershedId, parameters);
        break;
        
      case 'clip_to_watershed':
        // Clip data to watershed boundaries
        processingResult = await clipToWatershed(filePath, watershedId, parameters);
        break;
        
      default:
        throw new AppError('Invalid operation type', 400);
    }

    logger.info(`Spatial processing completed: ${operation} for watershed ${watershedId}`);

    res.json({
      status: 'success',
      message: 'Spatial data processed successfully',
      data: {
        operation,
        result: processingResult,
        processedAt: new Date()
      }
    });

  } catch (error) {
    logger.error(`Spatial processing error: ${error.message}`);
    throw new AppError(`Processing failed: ${error.message}`, 500);
  }
}));

// @route   GET /api/spatial/watersheds/:id/boundaries
// @desc    Get watershed boundaries
// @access  Private
router.get('/watersheds/:id/boundaries', authenticate, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id, {
    attributes: ['id', 'name', 'boundaries', 'centroid']
  });

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      watershed: {
        id: watershed.id,
        name: watershed.name,
        boundaries: watershed.boundaries,
        centroid: watershed.centroid
      }
    }
  });
}));

// @route   GET /api/spatial/watersheds/:id/intersection
// @desc    Get intersection with satellite data footprints
// @access  Private
router.get('/watersheds/:id/intersection', authenticate, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id, {
    attributes: ['id', 'name', 'boundaries']
  });

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // Get satellite data that intersects with watershed
  const intersectingSatelliteData = await SatelliteData.findAll({
    where: {
      watershedId: req.params.id,
      processingStatus: 'processed'
    },
    attributes: [
      'id', 'satellite', 'sceneId', 'acquisitionDate', 
      'footprint', 'cloudCover'
    ],
    order: [['acquisitionDate', 'DESC']]
  });

  // Simple intersection analysis (would use PostGIS in production)
  const analysis = {
    totalScenes: intersectingSatelliteData.length,
    bySatellite: {},
    coverage: {
      totalArea: watershed.boundaries ? 'Unknown' : 'No boundaries defined',
      averageCloudCover: 0
    },
    recommendations: []
  };

  // Calculate statistics by satellite
  intersectingSatelliteData.forEach(scene => {
    if (!analysis.bySatellite[scene.satellite]) {
      analysis.bySatellite[scene.satellite] = 0;
    }
    analysis.bySatellite[scene.satellite]++;
  });

  res.json({
    status: 'success',
    data: {
      analysis,
      scenes: intersectingSatelliteData
    }
  });
}));

// Helper functions (would be implemented with actual geospatial libraries)
async function extractBoundaries(filePath, watershedId, parameters) {
  // Implementation would use PostGIS or geospatial libraries
  return {
    boundaries: 'Extracted polygon data',
    centroid: 'Calculated centroid',
    area: 'Calculated area'
  };
}

async function updateCentroid(filePath, watershedId, parameters) {
  // Implementation would calculate centroid from polygon geometry
  return {
    centroid: 'New centroid coordinates',
    calculatedAt: new Date()
  };
}

async function validateCoverage(filePath, watershedId, parameters) {
  // Implementation would validate spatial coverage and completeness
  return {
    coveragePercentage: 95.5,
    gaps: [],
    recommendations: []
  };
}

async function clipToWatershed(filePath, watershedId, parameters) {
  // Implementation would clip data to watershed boundaries
  return {
    clippedData: 'Clipped feature collection',
    area: 'Clipped area value',
    featureCount: 100
  };
}

module.exports = router;
