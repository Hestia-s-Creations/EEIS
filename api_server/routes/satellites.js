const express = require('express');
const { SatelliteData, Watershed, ProcessingTask } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateSatelliteData, validateUUID } = require('../middleware/validation');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// @route   GET /api/satellites
// @desc    Get all satellite data with filtering and pagination
// @access  Private
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    watershedId,
    satellite,
    startDate,
    endDate,
    status,
    cloudCover,
    sortBy = 'acquisitionDate',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Apply filters
  if (watershedId) {
    whereClause.watershedId = watershedId;
  }

  if (satellite) {
    whereClause.satellite = satellite;
  }

  if (startDate || endDate) {
    whereClause.acquisitionDate = {};
    if (startDate) {
      whereClause.acquisitionDate[Op.gte] = startDate;
    }
    if (endDate) {
      whereClause.acquisitionDate[Op.lte] = endDate;
    }
  }

  if (status) {
    whereClause.processingStatus = status;
  }

  if (cloudCover) {
    whereClause.cloudCover = { [Op.lte]: parseFloat(cloudCover) };
  }

  const satelliteData = await SatelliteData.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code']
      }
    ]
  });

  res.json({
    status: 'success',
    data: {
      satelliteData: satelliteData.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(satelliteData.count / limit),
        totalItems: satelliteData.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/satellites/:id
// @desc    Get single satellite data by ID
// @access  Private
router.get('/:id', authenticate, validateUUID, catchAsync(async (req, res) => {
  const satelliteData = await SatelliteData.findByPk(req.params.id, {
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code', 'area']
      }
    ]
  });

  if (!satelliteData) {
    throw new AppError('Satellite data not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      satelliteData
    }
  });
}));

// @route   POST /api/satellites
// @desc    Create new satellite data entry
// @access  Private (Admin, Researcher)
router.post('/', authenticate, authorize('admin', 'researcher'), validateSatelliteData, catchAsync(async (req, res) => {
  // Verify watershed exists
  const watershed = await Watershed.findByPk(req.body.watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  const satelliteData = await SatelliteData.create(req.body);

  logger.info(`New satellite data created: ${satelliteData.sceneId} (${satelliteData.id})`);

  res.status(201).json({
    status: 'success',
    message: 'Satellite data created successfully',
    data: {
      satelliteData
    }
  });
}));

// @route   PUT /api/satellites/:id
// @desc    Update satellite data
// @access  Private (Admin, Researcher)
router.put('/:id', authenticate, authorize('admin', 'researcher'), validateUUID, catchAsync(async (req, res) => {
  const satelliteData = await SatelliteData.findByPk(req.params.id);

  if (!satelliteData) {
    throw new AppError('Satellite data not found', 404);
  }

  await satelliteData.update(req.body);

  logger.info(`Satellite data updated: ${satelliteData.sceneId} (${satelliteData.id})`);

  res.json({
    status: 'success',
    message: 'Satellite data updated successfully',
    data: {
      satelliteData
    }
  });
}));

// @route   DELETE /api/satellites/:id
// @desc    Delete satellite data
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize('admin'), validateUUID, catchAsync(async (req, res) => {
  const satelliteData = await SatelliteData.findByPk(req.params.id);

  if (!satelliteData) {
    throw new AppError('Satellite data not found', 404);
  }

  await satelliteData.destroy();

  logger.info(`Satellite data deleted: ${satelliteData.sceneId} (${satelliteData.id})`);

  res.json({
    status: 'success',
    message: 'Satellite data deleted successfully'
  });
}));

// @route   POST /api/satellites/:id/download
// @desc    Initiate satellite data download
// @access  Private (Admin, Researcher)
router.post('/:id/download', authenticate, authorize('admin', 'researcher'), validateUUID, catchAsync(async (req, res) => {
  const satelliteData = await SatelliteData.findByPk(req.params.id, {
    include: [{ model: Watershed, as: 'watershed' }]
  });

  if (!satelliteData) {
    throw new AppError('Satellite data not found', 404);
  }

  if (satelliteData.processingStatus === 'downloading' || satelliteData.processingStatus === 'processed') {
    throw new AppError('Satellite data is already being processed or has been processed', 400);
  }

  // Create processing task for download
  const task = await ProcessingTask.create({
    watershedId: satelliteData.watershedId,
    userId: req.user.id,
    taskType: 'satellite_download',
    taskName: `Download ${satelliteData.satellite} ${satelliteData.sceneId}`,
    description: `Downloading satellite data for ${satelliteData.watershed.name}`,
    parameters: {
      satelliteDataId: satelliteData.id,
      sceneId: satelliteData.sceneId,
      downloadUrl: satelliteData.downloadUrl
    },
    priority: 'normal'
  });

  // Update satellite data status
  await satelliteData.update({ processingStatus: 'downloading' });

  // Here you would typically initiate the actual download process
  // This could be done via a queue system like Bull/Redis or a background worker

  logger.info(`Download initiated for satellite data: ${satelliteData.sceneId} (${satelliteData.id})`);

  res.json({
    status: 'success',
    message: 'Download initiated successfully',
    data: {
      task,
      satelliteData
    }
  });
}));

// @route   GET /api/satellites/available-scenes
// @desc    Get available satellite scenes for a watershed and date range
// @access  Private (Admin, Researcher)
router.get('/available-scenes/:watershedId', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const { watershedId } = req.params;
  const { startDate, endDate, satellites } = req.query;

  // Verify watershed exists
  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // This would integrate with actual satellite data APIs (USGS, Copernicus, etc.)
  // For now, return mock data structure
  const availableScenes = {
    landsat8: [],
    landsat9: [],
    sentinel2: [],
    modis: []
  };

  // Mock implementation - replace with actual API integration
  const mockScenes = [
    {
      id: 'LC08_L1TP_123032_20231015_20231031_01_T1',
      satellite: 'landsat8',
      acquisitionDate: '2023-10-15',
      cloudCover: 15.2,
      path: 123,
      row: 32,
      downloadUrl: 'https://earthexplorer.usgs.gov/download/sample/LC08_L1TP_123032_20231015_20231031_01_T1'
    }
  ];

  res.json({
    status: 'success',
    data: {
      watershed: {
        id: watershed.id,
        name: watershed.name
      },
      availableScenes: mockScenes,
      filters: {
        startDate,
        endDate,
        satellites
      }
    }
  });
}));

// @route   GET /api/satellites/statistics
// @desc    Get satellite data statistics
// @access  Private
router.get('/statistics/overview', authenticate, catchAsync(async (req, res) => {
  const stats = await SatelliteData.findAll({
    attributes: [
      'satellite',
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalImages'],
      [sequelize.fn('AVG', sequelize.col('cloudCover')), 'avgCloudCover'],
      [sequelize.fn('MIN', sequelize.col('acquisitionDate')), 'earliestDate'],
      [sequelize.fn('MAX', sequelize.col('acquisitionDate')), 'latestDate']
    ],
    group: ['satellite'],
    order: [['satellite', 'ASC']]
  });

  const totalStats = await SatelliteData.findAll({
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalImages'],
      [sequelize.fn('AVG', sequelize.col('cloudCover')), 'avgCloudCover'],
      [
        sequelize.fn('COUNT', 
          sequelize.where(sequelize.col('processingStatus'), '=', 'processed')
        ), 
        'processedImages'
      ]
    ]
  });

  res.json({
    status: 'success',
    data: {
      bySatellite: stats,
      overall: totalStats[0]
    }
  });
}));

module.exports = router;
