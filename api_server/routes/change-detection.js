const express = require('express');
const { ChangeDetection, SatelliteData, Watershed } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateChangeDetection, validateUUID } = require('../middleware/validation');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// @route   GET /api/change-detection
// @desc    Get all change detections with filtering and pagination
// @access  Private
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    watershedId,
    algorithm,
    status,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Apply filters
  if (watershedId) {
    whereClause.watershedId = watershedId;
  }

  if (algorithm) {
    whereClause.algorithm = algorithm;
  }

  if (status) {
    whereClause.processingStatus = status;
  }

  const changeDetections = await ChangeDetection.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code']
      },
      {
        model: SatelliteData,
        as: 'baselineImage',
        attributes: ['id', 'satellite', 'acquisitionDate', 'sceneId']
      },
      {
        model: SatelliteData,
        as: 'comparisonImage',
        attributes: ['id', 'satellite', 'acquisitionDate', 'sceneId']
      }
    ]
  });

  res.json({
    status: 'success',
    data: {
      changeDetections: changeDetections.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(changeDetections.count / limit),
        totalItems: changeDetections.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/change-detection/:id
// @desc    Get single change detection by ID
// @access  Private
router.get('/:id', authenticate, validateUUID, catchAsync(async (req, res) => {
  const changeDetection = await ChangeDetection.findByPk(req.params.id, {
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code', 'area']
      },
      {
        model: SatelliteData,
        as: 'baselineImage',
        attributes: ['id', 'satellite', 'acquisitionDate', 'sceneId', 'cloudCover']
      },
      {
        model: SatelliteData,
        as: 'comparisonImage',
        attributes: ['id', 'satellite', 'acquisitionDate', 'sceneId', 'cloudCover']
      }
    ]
  });

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      changeDetection
    }
  });
}));

// @route   POST /api/change-detection
// @desc    Create new change detection analysis
// @access  Private (Admin, Researcher, Analyst)
router.post('/', authenticate, authorize('admin', 'researcher', 'analyst'), validateChangeDetection, catchAsync(async (req, res) => {
  const { watershedId, name, description, baselineImageId, comparisonImageId, algorithm, thresholds, processingParameters } = req.body;

  // Verify watershed exists
  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // Verify satellite images exist
  const baselineImage = await SatelliteData.findByPk(baselineImageId);
  const comparisonImage = await SatelliteData.findByPk(comparisonImageId);

  if (!baselineImage || !comparisonImage) {
    throw new AppError('One or both satellite images not found', 404);
  }

  if (baselineImage.watershedId !== watershedId || comparisonImage.watershedId !== watershedId) {
    throw new AppError('Satellite images must belong to the specified watershed', 400);
  }

  const changeDetection = await ChangeDetection.create({
    watershedId,
    name,
    description,
    baselineImageId,
    comparisonImageId,
    baselineDate: baselineImage.acquisitionDate,
    comparisonDate: comparisonImage.acquisitionDate,
    algorithm,
    thresholds: thresholds || {},
    processingParameters: processingParameters || {},
    createdBy: req.user.id,
    metadata: {
      createdBy: req.user.username,
      createdAt: new Date().toISOString()
    }
  });

  logger.info(`New change detection created: ${changeDetection.name} (${changeDetection.id})`);

  res.status(201).json({
    status: 'success',
    message: 'Change detection created successfully',
    data: {
      changeDetection
    }
  });
}));

// @route   PUT /api/change-detection/:id
// @desc    Update change detection
// @access  Private (Admin, Researcher)
router.put('/:id', authenticate, authorize('admin', 'researcher'), validateUUID, catchAsync(async (req, res) => {
  const changeDetection = await ChangeDetection.findByPk(req.params.id);

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  // Only allow updates if not completed or failed
  if (changeDetection.processingStatus === 'completed') {
    throw new AppError('Cannot update completed change detection', 400);
  }

  await changeDetection.update(req.body);

  logger.info(`Change detection updated: ${changeDetection.name} (${changeDetection.id})`);

  res.json({
    status: 'success',
    message: 'Change detection updated successfully',
    data: {
      changeDetection
    }
  });
}));

// @route   DELETE /api/change-detection/:id
// @desc    Delete change detection
// @access  Private (Admin only)
router.delete('/:id', authenticate, authorize('admin'), validateUUID, catchAsync(async (req, res) => {
  const changeDetection = await ChangeDetection.findByPk(req.params.id);

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  await changeDetection.destroy();

  logger.info(`Change detection deleted: ${changeDetection.name} (${changeDetection.id})`);

  res.json({
    status: 'success',
    message: 'Change detection deleted successfully'
  });
}));

// @route   POST /api/change-detection/:id/process
// @desc    Start change detection processing
// @access  Private (Admin, Researcher, Analyst)
router.post('/:id/process', authenticate, authorize('admin', 'researcher', 'analyst'), validateUUID, catchAsync(async (req, res) => {
  const changeDetection = await ChangeDetection.findByPk(req.params.id, {
    include: [
      { model: Watershed, as: 'watershed' },
      { model: SatelliteData, as: 'baselineImage' },
      { model: SatelliteData, as: 'comparisonImage' }
    ]
  });

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  if (changeDetection.processingStatus === 'processing') {
    throw new AppError('Change detection is already being processed', 400);
  }

  if (changeDetection.processingStatus === 'completed') {
    throw new AppError('Change detection has already been completed', 400);
  }

  // Update processing status
  await changeDetection.update({
    processingStatus: 'processing',
    progress: 0,
    processingStartedAt: new Date()
  });

  // Here you would typically trigger the actual processing
  // This could be done via a queue system or background worker
  // For now, we'll simulate the processing

  logger.info(`Change detection processing started: ${changeDetection.name} (${changeDetection.id})`);

  res.json({
    status: 'success',
    message: 'Change detection processing started',
    data: {
      changeDetection
    }
  });
}));

// @route   POST /api/change-detection/:id/results
// @desc    Submit processing results for change detection
// @access  Private (Admin, Researcher)
router.post('/:id/results', authenticate, authorize('admin', 'researcher'), validateUUID, catchAsync(async (req, res) => {
  const changeDetection = await ChangeDetection.findByPk(req.params.id);

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  const { resultData, statistics, classifiedChanges, confidenceScores, visualizationUrl, resultFilePath } = req.body;

  const updates = {
    processingStatus: 'completed',
    progress: 100,
    processingCompletedAt: new Date()
  };

  if (resultData) updates.resultData = resultData;
  if (statistics) updates.statistics = statistics;
  if (classifiedChanges) updates.classifiedChanges = classifiedChanges;
  if (confidenceScores) updates.confidenceScores = confidenceScores;
  if (visualizationUrl) updates.visualizationUrl = visualizationUrl;
  if (resultFilePath) updates.resultFilePath = resultFilePath;

  await changeDetection.update(updates);

  logger.info(`Change detection processing completed: ${changeDetection.name} (${changeDetection.id})`);

  res.json({
    status: 'success',
    message: 'Change detection results submitted successfully',
    data: {
      changeDetection
    }
  });
}));

// @route   GET /api/change-detection/statistics
// @desc    Get change detection statistics
// @access  Private
router.get('/statistics/overview', authenticate, catchAsync(async (req, res) => {
  const statsByAlgorithm = await ChangeDetection.findAll({
    attributes: [
      'algorithm',
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalAnalyses'],
      [sequelize.fn('AVG', sequelize.col('statistics.changePercentage')), 'avgChangePercentage'],
      [
        sequelize.fn('COUNT', 
          sequelize.where(sequelize.col('processingStatus'), '=', 'completed')
        ), 
        'completedAnalyses'
      ]
    ],
    group: ['algorithm'],
    order: [['algorithm', 'ASC']]
  });

  const recentAnalyses = await ChangeDetection.findAll({
    where: {
      createdAt: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('statistics.changePercentage')), 'avgChangePercentage']
    ]
  });

  res.json({
    status: 'success',
    data: {
      byAlgorithm: statsByAlgorithm,
      recentActivity: recentAnalyses[0]
    }
  });
}));

// @route   GET /api/change-detection/export/:id
// @desc    Export change detection results
// @access  Private
router.get('/export/:id', authenticate, validateUUID, catchAsync(async (req, res) => {
  const { format = 'json' } = req.query;
  
  const changeDetection = await ChangeDetection.findByPk(req.params.id);

  if (!changeDetection) {
    throw new AppError('Change detection not found', 404);
  }

  if (changeDetection.processingStatus !== 'completed') {
    throw new AppError('Change detection processing not completed', 400);
  }

  const exportData = {
    id: changeDetection.id,
    name: changeDetection.name,
    algorithm: changeDetection.algorithm,
    statistics: changeDetection.statistics,
    classifiedChanges: changeDetection.classifiedChanges,
    baselineDate: changeDetection.baselineDate,
    comparisonDate: changeDetection.comparisonDate,
    exportedAt: new Date().toISOString(),
    exportedBy: req.user.username
  };

  if (format === 'csv') {
    // Convert to CSV format
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="change-detection-${changeDetection.id}.csv"`);
    
    // Simple CSV conversion - in real implementation, use proper CSV library
    const csv = 'Field,Value\n' +
      `Name,${changeDetection.name}\n` +
      `Algorithm,${changeDetection.algorithm}\n` +
      `Change Percentage,${changeDetection.statistics.changePercentage}\n` +
      `Baseline Date,${changeDetection.baselineDate}\n` +
      `Comparison Date,${changeDetection.comparisonDate}`;
    
    res.send(csv);
  } else {
    res.json({
      status: 'success',
      data: exportData
    });
  }
}));

module.exports = router;
