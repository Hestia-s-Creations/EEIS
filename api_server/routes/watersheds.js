const express = require('express');
const { Watershed, SatelliteData, ChangeDetection } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateWatershed, validateUUID } = require('../middleware/validation');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// @route   GET /api/watersheds
// @desc    Get all watersheds with filtering and pagination
// @access  Private
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'name',
    sortOrder = 'ASC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Search filter
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { code: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Status filter
  if (status) {
    whereClause.status = status;
  }

  const watersheds = await Watershed.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      {
        model: SatelliteData,
        as: 'satelliteData',
        attributes: ['id', 'satellite', 'acquisitionDate', 'processingStatus'],
        limit: 5,
        order: [['acquisitionDate', 'DESC']]
      }
    ]
  });

  res.json({
    status: 'success',
    data: {
      watersheds: watersheds.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(watersheds.count / limit),
        totalItems: watersheds.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/watersheds/:id
// @desc    Get single watershed by ID
// @access  Private
router.get('/:id', authenticate, validateUUID, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id, {
    include: [
      {
        model: SatelliteData,
        as: 'satelliteData',
        order: [['acquisitionDate', 'DESC']]
      },
      {
        model: ChangeDetection,
        as: 'changeDetections',
        order: [['createdAt', 'DESC']],
        limit: 10
      }
    ]
  });

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      watershed
    }
  });
}));

// @route   POST /api/watersheds
// @desc    Create new watershed
// @access  Private (Admin, Researcher)
router.post('/', authenticate, authorize('admin', 'researcher'), validateWatershed, catchAsync(async (req, res) => {
  const watershed = await Watershed.create(req.body);

  logger.info(`New watershed created: ${watershed.name} (${watershed.id})`);

  res.status(201).json({
    status: 'success',
    message: 'Watershed created successfully',
    data: {
      watershed
    }
  });
}));

// @route   PUT /api/watersheds/:id
// @desc    Update watershed
// @access  Private (Admin, Researcher)
router.put('/:id', authenticate, authorize('admin', 'researcher'), validateUUID, validateWatershed, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id);

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  await watershed.update(req.body);

  logger.info(`Watershed updated: ${watershed.name} (${watershed.id})`);

  res.json({
    status: 'success',
    message: 'Watershed updated successfully',
    data: {
      watershed
    }
  });
}));

// @route   DELETE /api/watersheds/:id
// @desc    Delete watershed
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize('admin'), validateUUID, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id);

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // Check if watershed has associated data
  const satelliteCount = await SatelliteData.count({ where: { watershedId: watershed.id } });
  const changeDetectionCount = await ChangeDetection.count({ where: { watershedId: watershed.id } });

  if (satelliteCount > 0 || changeDetectionCount > 0) {
    throw new AppError('Cannot delete watershed with associated satellite data or change detections', 400);
  }

  await watershed.destroy();

  logger.info(`Watershed deleted: ${watershed.name} (${watershed.id})`);

  res.json({
    status: 'success',
    message: 'Watershed deleted successfully'
  });
}));

// @route   GET /api/watersheds/:id/statistics
// @desc    Get watershed statistics
// @access  Private
router.get('/:id/statistics', authenticate, validateUUID, catchAsync(async (req, res) => {
  const watershed = await Watershed.findByPk(req.params.id);

  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  const satelliteStats = await SatelliteData.findAll({
    where: { watershedId: watershed.id },
    attributes: [
      'satellite',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('cloudCover')), 'avgCloudCover']
    ],
    group: ['satellite']
  });

  const changeDetectionStats = await ChangeDetection.findAll({
    where: { watershedId: watershed.id },
    attributes: [
      'processingStatus',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('statistics.changePercentage')), 'avgChangePercentage']
    ],
    group: ['processingStatus']
  });

  res.json({
    status: 'success',
    data: {
      statistics: {
        satelliteData: satelliteStats,
        changeDetections: changeDetectionStats,
        summary: {
          totalSatelliteImages: satelliteStats.reduce((sum, stat) => sum + parseInt(stat.dataValues.count), 0),
          totalChangeDetections: changeDetectionStats.reduce((sum, stat) => sum + parseInt(stat.dataValues.count), 0)
        }
      }
    }
  });
}));

// @route   GET /api/watersheds/:id/satellite-data
// @desc    Get satellite data for watershed
// @access  Private
router.get('/:id/satellite-data', authenticate, validateUUID, catchAsync(async (req, res) => {
  const { satellite, startDate, endDate, status } = req.query;

  const whereClause = { watershedId: req.params.id };

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

  const satelliteData = await SatelliteData.findAll({
    where: whereClause,
    order: [['acquisitionDate', 'DESC']],
    limit: 100 // Limit results
  });

  res.json({
    status: 'success',
    data: {
      satelliteData,
      count: satelliteData.length
    }
  });
}));

module.exports = router;
