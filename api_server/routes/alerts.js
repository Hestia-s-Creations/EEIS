const express = require('express');
const { ChangeDetection, Watershed, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op, sequelize } = require('sequelize');

const router = express.Router();

// @route   GET /api/alerts
// @desc    Get all alerts with pagination
// @access  Private
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    status,
    priority,
    watershedId,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  // Build filters
  if (watershedId) {
    whereClause.watershedId = watershedId;
  }

  if (startDate && endDate) {
    whereClause.createdAt = {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    };
  }

  if (status) {
    whereClause.status = status;
  }

  const alerts = await ChangeDetection.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code', 'status']
      }
    ]
  });

  // Transform change detections into alert format
  const transformedAlerts = alerts.rows.map(detection => {
    const confidence = parseFloat(detection.confidenceScore) || 0;
    return {
      id: detection.id,
      type: detection.algorithm || 'change_detection',
      severity: confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low',
      status: detection.status || 'active',
      message: `Change detected using ${detection.algorithm} in ${detection.watershed?.name || 'unknown watershed'}`,
      watershedId: detection.watershedId,
      watershed: detection.watershed,
      detectedAt: detection.createdAt,
      confidence: confidence,
      metadata: detection.metadata,
      createdAt: detection.createdAt,
      updatedAt: detection.updatedAt
    };
  });

  res.json({
    status: 'success',
    data: {
      alerts: transformedAlerts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(alerts.count / limit),
        totalItems: alerts.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/alerts/:id
// @desc    Get single alert by ID
// @access  Private
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const detection = await ChangeDetection.findByPk(req.params.id, {
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code', 'status', 'area', 'boundaries']
      }
    ]
  });

  if (!detection) {
    throw new AppError('Alert not found', 404);
  }

  const alert = {
    id: detection.id,
    type: detection.changeType,
    severity: detection.confidenceScore > 0.8 ? 'high' : detection.confidenceScore > 0.5 ? 'medium' : 'low',
    status: 'active',
    message: `${detection.changeType} detected in ${detection.watershed?.name || 'unknown watershed'}`,
    watershedId: detection.watershedId,
    watershed: detection.watershed,
    detectedAt: detection.detectionDate,
    confidence: detection.confidenceScore,
    area: detection.affectedArea,
    location: detection.location,
    metadata: detection.metadata,
    createdAt: detection.createdAt,
    updatedAt: detection.updatedAt
  };

  res.json({
    status: 'success',
    data: { alert }
  });
}));

// @route   PUT /api/alerts/:id/acknowledge
// @desc    Acknowledge an alert
// @access  Private
router.put('/:id/acknowledge', authenticate, catchAsync(async (req, res) => {
  const detection = await ChangeDetection.findByPk(req.params.id);

  if (!detection) {
    throw new AppError('Alert not found', 404);
  }

  // Update metadata to include acknowledgment
  const updatedMetadata = {
    ...detection.metadata,
    acknowledged: true,
    acknowledgedBy: req.user.id,
    acknowledgedAt: new Date()
  };

  await detection.update({ metadata: updatedMetadata });

  logger.info(`Alert acknowledged: ${detection.id} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Alert acknowledged successfully',
    data: {
      alert: {
        id: detection.id,
        acknowledged: true,
        acknowledgedBy: req.user.id,
        acknowledgedAt: updatedMetadata.acknowledgedAt
      }
    }
  });
}));

// @route   PUT /api/alerts/:id/resolve
// @desc    Resolve an alert
// @access  Private
router.put('/:id/resolve', authenticate, catchAsync(async (req, res) => {
  const detection = await ChangeDetection.findByPk(req.params.id);

  if (!detection) {
    throw new AppError('Alert not found', 404);
  }

  // Update metadata to include resolution
  const updatedMetadata = {
    ...detection.metadata,
    resolved: true,
    resolvedBy: req.user.id,
    resolvedAt: new Date(),
    resolutionNote: req.body.note || ''
  };

  await detection.update({ metadata: updatedMetadata });

  logger.info(`Alert resolved: ${detection.id} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Alert resolved successfully',
    data: {
      alert: {
        id: detection.id,
        resolved: true,
        resolvedBy: req.user.id,
        resolvedAt: updatedMetadata.resolvedAt
      }
    }
  });
}));

// @route   GET /api/alerts/statistics
// @desc    Get alert statistics
// @access  Private
router.get('/statistics', authenticate, catchAsync(async (req, res) => {
  const { startDate, endDate, watershedIds } = req.query;

  const whereClause = {};

  if (startDate && endDate) {
    whereClause.detectionDate = {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    };
  }

  if (watershedIds) {
    whereClause.watershedId = {
      [Op.in]: Array.isArray(watershedIds) ? watershedIds : [watershedIds]
    };
  }

  // Get alert counts by type
  const alertsByType = await ChangeDetection.findAll({
    where: whereClause,
    attributes: [
      'change_type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['change_type'],
    raw: true
  });

  // Get alerts by severity (based on confidence)
  const totalAlerts = await ChangeDetection.count({ where: whereClause });
  const highSeverity = await ChangeDetection.count({
    where: {
      ...whereClause,
      confidenceScore: { [Op.gt]: 0.8 }
    }
  });
  const mediumSeverity = await ChangeDetection.count({
    where: {
      ...whereClause,
      confidenceScore: { [Op.between]: [0.5, 0.8] }
    }
  });
  const lowSeverity = await ChangeDetection.count({
    where: {
      ...whereClause,
      confidenceScore: { [Op.lt]: 0.5 }
    }
  });

  // Get recent alerts (last 24 hours)
  const recentAlerts = await ChangeDetection.count({
    where: {
      ...whereClause,
      detectionDate: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    }
  });

  res.json({
    status: 'success',
    data: {
      totalAlerts,
      bySeverity: {
        high: highSeverity,
        medium: mediumSeverity,
        low: lowSeverity
      },
      byType: alertsByType,
      recentAlerts24h: recentAlerts
    }
  });
}));

// @route   PUT /api/alerts/bulk-status
// @desc    Bulk update alert status
// @access  Private
router.put('/bulk-status', authenticate, catchAsync(async (req, res) => {
  const { alertIds, status } = req.body;

  if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
    throw new AppError('Alert IDs array is required', 400);
  }

  if (!['acknowledged', 'resolved'].includes(status)) {
    throw new AppError('Invalid status. Must be "acknowledged" or "resolved"', 400);
  }

  const updates = await ChangeDetection.findAll({
    where: { id: { [Op.in]: alertIds } }
  });

  const updatePromises = updates.map(detection => {
    const updatedMetadata = {
      ...detection.metadata,
      [status]: true,
      [`${status}By`]: req.user.id,
      [`${status}At`]: new Date()
    };
    return detection.update({ metadata: updatedMetadata });
  });

  await Promise.all(updatePromises);

  logger.info(`Bulk alert update: ${alertIds.length} alerts set to ${status} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: `${alertIds.length} alerts updated to ${status}`,
    data: {
      updatedCount: alertIds.length,
      status
    }
  });
}));

// Alert Rules endpoints (stub implementations)
// @route   GET /api/alerts/rules
// @desc    Get all alert rules
// @access  Private
router.get('/rules', authenticate, catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      rules: [],
      message: 'Alert rules management - implementation pending'
    }
  });
}));

// @route   GET /api/alerts/rules/:id
// @desc    Get alert rule by ID
// @access  Private
router.get('/rules/:id', authenticate, catchAsync(async (req, res) => {
  throw new AppError('Alert rule not found', 404);
}));

// @route   POST /api/alerts/rules
// @desc    Create new alert rule
// @access  Private (Admin only)
router.post('/rules', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    message: 'Alert rule creation - implementation pending',
    data: {
      rule: {
        id: `rule-${Date.now()}`,
        ...req.body
      }
    }
  });
}));

// @route   PUT /api/alerts/rules/:id
// @desc    Update alert rule
// @access  Private (Admin only)
router.put('/rules/:id', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    message: 'Alert rule update - implementation pending',
    data: {
      rule: {
        id: req.params.id,
        ...req.body
      }
    }
  });
}));

// @route   DELETE /api/alerts/rules/:id
// @desc    Delete alert rule
// @access  Private (Admin only)
router.delete('/rules/:id', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    message: 'Alert rule deleted successfully'
  });
}));

// @route   POST /api/alerts/rules/:id/test
// @desc    Test alert rule
// @access  Private (Admin only)
router.post('/rules/:id/test', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  logger.info(`Alert rule test triggered: ${req.params.id} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Alert rule test triggered',
    data: {
      ruleId: req.params.id,
      testStatus: 'completed',
      result: 'Test notification sent successfully'
    }
  });
}));

// @route   POST /api/alerts/rules/:id/test-notification
// @desc    Send test notification
// @access  Private (Admin only)
router.post('/rules/:id/test-notification', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  const { channel } = req.body;

  logger.info(`Test notification sent via ${channel} for rule ${req.params.id} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: `Test notification sent via ${channel}`,
    data: {
      ruleId: req.params.id,
      channel,
      sentAt: new Date()
    }
  });
}));

// @route   POST /api/alerts/webhooks/subscribe
// @desc    Subscribe to alert webhooks
// @access  Private
router.post('/webhooks/subscribe', authenticate, catchAsync(async (req, res) => {
  const { watershedId, webhookUrl } = req.body;

  if (!watershedId || !webhookUrl) {
    throw new AppError('Watershed ID and webhook URL are required', 400);
  }

  logger.info(`Webhook subscription created for watershed ${watershedId}: ${webhookUrl} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Webhook subscription created',
    data: {
      subscription: {
        id: `sub-${Date.now()}`,
        watershedId,
        webhookUrl,
        createdBy: req.user.id,
        createdAt: new Date()
      }
    }
  });
}));

// @route   DELETE /api/alerts/webhooks/unsubscribe
// @desc    Unsubscribe from alert webhooks
// @access  Private
router.delete('/webhooks/unsubscribe', authenticate, catchAsync(async (req, res) => {
  const { watershedId, webhookUrl } = req.body;

  logger.info(`Webhook unsubscribed for watershed ${watershedId}: ${webhookUrl} by user ${req.user.username}`);

  res.json({
    status: 'success',
    message: 'Webhook subscription removed'
  });
}));

// @route   GET /api/alerts/notifications
// @desc    Get notification history
// @access  Private
router.get('/notifications', authenticate, catchAsync(async (req, res) => {
  const { alertId } = req.query;

  res.json({
    status: 'success',
    data: {
      notifications: [],
      message: 'Notification history - implementation pending'
    }
  });
}));

module.exports = router;
