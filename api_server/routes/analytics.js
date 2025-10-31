const express = require('express');
const { Watershed, SatelliteData, ChangeDetection, ProcessingTask, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op, sequelize } = require('sequelize');

const router = express.Router();

// @route   GET /api/analytics/trends
// @desc    Get analytics trends over time
// @access  Private
router.get('/trends', authenticate, catchAsync(async (req, res) => {
  const {
    dateRange,
    watersheds,
    metrics,
    startDate,
    endDate
  } = req.query;

  // Default to last 30 days if no date range provided
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  // Build watershed filter
  const watershedFilter = watersheds ? { id: { [Op.in]: Array.isArray(watersheds) ? watersheds : [watersheds] } } : {};

  // Get change detection trends
  const changeDetectionTrends = await ChangeDetection.findAll({
    where: {
      createdAt: {
        [Op.between]: [start, end]
      },
      ...(Object.keys(watershedFilter).length > 0 && { watershedId: watershedFilter.id })
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('confidence_score')), 'avgConfidence'],
      'algorithm'
    ],
    group: [sequelize.fn('DATE', sequelize.col('created_at')), 'algorithm'],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true
  });

  // Get processing task trends
  const processingTrends = await ProcessingTask.findAll({
    where: {
      createdAt: {
        [Op.between]: [start, end]
      }
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      'status',
      'task_type'
    ],
    group: [sequelize.fn('DATE', sequelize.col('created_at')), 'status', 'task_type'],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true
  });

  // Get satellite data acquisition trends
  const satelliteTrends = await SatelliteData.findAll({
    where: {
      acquisitionDate: {
        [Op.between]: [start, end]
      },
      ...(Object.keys(watershedFilter).length > 0 && { watershedId: watershedFilter.id })
    },
    attributes: [
      [sequelize.fn('DATE', sequelize.col('acquisition_date')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      'satellite_name',
      [sequelize.fn('AVG', sequelize.col('cloud_cover')), 'avgCloudCover']
    ],
    group: [sequelize.fn('DATE', sequelize.col('acquisition_date')), 'satellite_name'],
    order: [[sequelize.fn('DATE', sequelize.col('acquisition_date')), 'ASC']],
    raw: true
  });

  res.json({
    status: 'success',
    data: {
      dateRange: { start, end },
      trends: {
        changeDetection: changeDetectionTrends,
        processing: processingTrends,
        satellite: satelliteTrends
      },
      summary: {
        totalChangesDetected: changeDetectionTrends.reduce((sum, item) => sum + parseInt(item.count), 0),
        totalTasksProcessed: processingTrends.reduce((sum, item) => sum + parseInt(item.count), 0),
        totalSatelliteImages: satelliteTrends.reduce((sum, item) => sum + parseInt(item.count), 0)
      }
    }
  });
}));

// @route   GET /api/analytics/realtime
// @desc    Get real-time system metrics
// @access  Private
router.get('/realtime', authenticate, catchAsync(async (req, res) => {
  // Get active processing tasks
  const activeTasks = await ProcessingTask.count({
    where: { status: 'running' }
  });

  // Get recent changes (last hour)
  const recentChanges = await ChangeDetection.count({
    where: {
      createdAt: {
        [Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  // Get pending tasks
  const pendingTasks = await ProcessingTask.count({
    where: { status: 'pending' }
  });

  // Get completed tasks today
  const completedToday = await ProcessingTask.count({
    where: {
      status: 'completed',
      updatedAt: {
        [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });

  // Get active watersheds (with recent activity)
  const activeWatersheds = await Watershed.count({
    include: [{
      model: ChangeDetection,
      as: 'changeDetections',
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      },
      required: true
    }]
  });

  // Get system health metrics
  const failedTasks = await ProcessingTask.count({
    where: {
      status: 'failed',
      updatedAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  // Calculate success rate
  const totalTasksLast24h = await ProcessingTask.count({
    where: {
      status: { [Op.in]: ['completed', 'failed'] },
      updatedAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  const successRate = totalTasksLast24h > 0 ? ((totalTasksLast24h - failedTasks) / totalTasksLast24h * 100).toFixed(2) : 100;

  res.json({
    status: 'success',
    data: {
      timestamp: new Date(),
      metrics: {
        activeProcessingTasks: activeTasks,
        pendingTasks: pendingTasks,
        completedToday: completedToday,
        recentChangesDetected: recentChanges,
        activeWatersheds: activeWatersheds,
        systemHealth: {
          successRate: parseFloat(successRate),
          failedTasksLast24h: failedTasks,
          totalTasksLast24h: totalTasksLast24h
        }
      },
      performance: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    }
  });
}));

// @route   GET /api/analytics/data
// @desc    Get general analytics data
// @access  Private
router.get('/data', authenticate, catchAsync(async (req, res) => {
  const {
    watershedId,
    metrics,
    startDate,
    endDate,
    aggregation = 'daily'
  } = req.query;

  const whereClause = {};
  if (watershedId) whereClause.watershedId = watershedId;
  if (startDate && endDate) {
    whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }

  const data = await ChangeDetection.findAll({
    where: whereClause,
    include: [{
      model: Watershed,
      as: 'watershed',
      attributes: ['id', 'name', 'code']
    }],
    order: [['createdAt', 'DESC']],
    limit: 100
  });

  res.json({
    status: 'success',
    data: {
      records: data,
      aggregation,
      count: data.length
    }
  });
}));

// @route   GET /api/analytics/watershed/:watershedId
// @desc    Get watershed-specific analytics
// @access  Private
router.get('/watershed/:watershedId', authenticate, catchAsync(async (req, res) => {
  const { watershedId } = req.params;
  const { startDate, endDate, metrics } = req.query;

  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.detectionDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }

  const changes = await ChangeDetection.findAll({
    where: { watershedId, ...dateFilter },
    attributes: [
      'change_type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('confidence_score')), 'avgConfidence']
    ],
    group: ['change_type'],
    raw: true
  });

  const satelliteData = await SatelliteData.count({
    where: { watershedId }
  });

  res.json({
    status: 'success',
    data: {
      watershed,
      analytics: {
        changesByType: changes,
        totalSatelliteImages: satelliteData,
        lastUpdated: new Date()
      }
    }
  });
}));

// @route   GET /api/analytics/disturbance
// @desc    Get disturbance analysis
// @access  Private
router.get('/disturbance', authenticate, catchAsync(async (req, res) => {
  const { watershedIds, startDate, endDate, severity, type } = req.query;

  const whereClause = {};
  if (watershedIds) {
    whereClause.watershedId = { [Op.in]: Array.isArray(watershedIds) ? watershedIds : [watershedIds] };
  }
  if (startDate && endDate) {
    whereClause.detectionDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
  }
  if (type) {
    whereClause.changeType = type;
  }

  const disturbances = await ChangeDetection.findAll({
    where: whereClause,
    include: [{
      model: Watershed,
      as: 'watershed',
      attributes: ['id', 'name', 'code']
    }],
    order: [['detectionDate', 'DESC']]
  });

  res.json({
    status: 'success',
    data: {
      disturbances,
      count: disturbances.length
    }
  });
}));

// @route   GET /api/analytics/health/:watershedId
// @desc    Get watershed health score analysis
// @access  Private
router.get('/health/:watershedId', authenticate, catchAsync(async (req, res) => {
  const { watershedId } = req.params;
  const { timeRange, startDate, endDate } = req.query;

  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  // Calculate health score based on recent changes
  const recentChanges = await ChangeDetection.count({
    where: {
      watershedId,
      detectionDate: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  // Simple health score: fewer changes = better health
  const healthScore = Math.max(0, 100 - (recentChanges * 5));

  res.json({
    status: 'success',
    data: {
      watershedId,
      healthScore,
      recentChanges,
      status: healthScore > 80 ? 'excellent' : healthScore > 60 ? 'good' : healthScore > 40 ? 'fair' : 'poor',
      lastAssessed: new Date()
    }
  });
}));

// @route   GET /api/analytics/vegetation
// @desc    Get vegetation analysis
// @access  Private
router.get('/vegetation', authenticate, catchAsync(async (req, res) => {
  const { watershedIds, startDate, endDate, vegetationIndex = 'NDVI' } = req.query;

  res.json({
    status: 'success',
    data: {
      vegetationIndex,
      message: 'Vegetation analysis endpoint - implementation pending',
      note: 'Requires satellite imagery processing integration'
    }
  });
}));

// @route   GET /api/analytics/water-quality
// @desc    Get water quality analysis
// @access  Private
router.get('/water-quality', authenticate, catchAsync(async (req, res) => {
  const { watershedIds, startDate, endDate, parameters } = req.query;

  res.json({
    status: 'success',
    data: {
      message: 'Water quality analysis endpoint - implementation pending',
      note: 'Requires water quality sensor data integration'
    }
  });
}));

// @route   GET /api/analytics/spatial
// @desc    Get spatial analysis
// @access  Private
router.get('/spatial', authenticate, catchAsync(async (req, res) => {
  const { watershedIds, analysisType, metrics } = req.query;

  res.json({
    status: 'success',
    data: {
      analysisType: analysisType || 'correlation',
      message: 'Spatial analysis endpoint - implementation pending',
      note: 'Requires advanced GIS processing'
    }
  });
}));

// @route   GET /api/analytics/predictive/:watershedId
// @desc    Get predictive analysis
// @access  Private
router.get('/predictive/:watershedId', authenticate, catchAsync(async (req, res) => {
  const { watershedId } = req.params;
  const { predictionHorizon, modelType, metrics } = req.query;

  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  res.json({
    status: 'success',
    data: {
      watershedId,
      predictionHorizon: predictionHorizon || 30,
      modelType: modelType || 'linear',
      message: 'Predictive analysis endpoint - implementation pending',
      note: 'Requires ML model integration'
    }
  });
}));

// @route   POST /api/analytics/comparisons/:type
// @desc    Get comparative analysis
// @access  Private
router.post('/comparisons/:type', authenticate, catchAsync(async (req, res) => {
  const { type } = req.params;
  const config = req.body;

  res.json({
    status: 'success',
    data: {
      type,
      config,
      message: 'Comparison analysis endpoint - implementation pending'
    }
  });
}));

// @route   POST /api/analytics/reports/generate
// @desc    Generate analytics report
// @access  Private
router.post('/reports/generate', authenticate, catchAsync(async (req, res) => {
  const { type, config, format } = req.body;

  // Create a mock report task
  const reportId = `report-${Date.now()}`;

  logger.info(`Report generation requested: ${reportId} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Report generation started',
    data: {
      reportId,
      status: 'processing',
      type,
      format,
      estimatedCompletion: new Date(Date.now() + 60000) // 1 minute
    }
  });
}));

// @route   GET /api/analytics/reports
// @desc    Get list of generated reports
// @access  Private
router.get('/reports', authenticate, catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      reports: [],
      message: 'No reports available - report storage implementation pending'
    }
  });
}));

// @route   GET /api/analytics/reports/:reportId/download
// @desc    Download generated report
// @access  Private
router.get('/reports/:reportId/download', authenticate, catchAsync(async (req, res) => {
  const { reportId } = req.params;

  throw new AppError('Report not found', 404);
}));

// @route   DELETE /api/analytics/reports/:reportId
// @desc    Delete generated report
// @access  Private
router.delete('/reports/:reportId', authenticate, catchAsync(async (req, res) => {
  const { reportId } = req.params;

  res.json({
    status: 'success',
    message: 'Report deleted successfully'
  });
}));

module.exports = router;
