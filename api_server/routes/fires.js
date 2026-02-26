const express = require('express');
const { FireEvent, Watershed } = require('../models');
const { authenticate } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// @route   GET /api/fires
// @desc    Get all fire events with pagination
// @access  Private
router.get('/', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 50,
    status,
    watershedId,
    startDate,
    endDate,
    sortBy = 'detectedAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (status) whereClause.status = status;
  if (watershedId) whereClause.watershedId = watershedId;
  if (startDate && endDate) {
    whereClause.detectedAt = {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    };
  }

  const fires = await FireEvent.findAndCountAll({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      { model: Watershed, as: 'watershed', attributes: ['id', 'name', 'code', 'status'] }
    ]
  });

  res.json({
    status: 'success',
    data: {
      fires: fires.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(fires.count / limit),
        totalItems: fires.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/fires/:id
// @desc    Get single fire event
// @access  Private
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const fire = await FireEvent.findByPk(req.params.id, {
    include: [
      { model: Watershed, as: 'watershed', attributes: ['id', 'name', 'code', 'status', 'area', 'boundaries'] }
    ]
  });

  if (!fire) throw new AppError('Fire event not found', 404);

  res.json({ status: 'success', data: { fire } });
}));

// @route   POST /api/fires
// @desc    Create manual fire event
// @access  Private
router.post('/', authenticate, catchAsync(async (req, res) => {
  const { watershedId, latitude, longitude, confidence, frp, metadata } = req.body;

  if (!watershedId || !latitude || !longitude) {
    throw new AppError('watershedId, latitude, and longitude are required', 400);
  }

  const fire = await FireEvent.create({
    watershedId,
    source: 'manual',
    latitude,
    longitude,
    confidence: confidence || null,
    frp: frp || null,
    status: 'detected',
    metadata: metadata || {}
  });

  logger.info(`Manual fire event created: ${fire.id} at [${latitude}, ${longitude}]`);

  res.status(201).json({
    status: 'success',
    message: 'Fire event created',
    data: { fire }
  });
}));

// @route   PUT /api/fires/:id/status
// @desc    Update fire event status
// @access  Private
router.put('/:id/status', authenticate, catchAsync(async (req, res) => {
  const { status: newStatus } = req.body;
  const validStatuses = ['detected', 'processing', 'classified', 'resolved'];

  if (!validStatuses.includes(newStatus)) {
    throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  const fire = await FireEvent.findByPk(req.params.id);
  if (!fire) throw new AppError('Fire event not found', 404);

  await fire.update({ status: newStatus });
  logger.info(`Fire event ${fire.id} status updated to ${newStatus}`);

  res.json({
    status: 'success',
    message: `Fire event status updated to ${newStatus}`,
    data: { fire }
  });
}));

// @route   GET /api/fires/active/summary
// @desc    Get summary of active fire events
// @access  Private
router.get('/active/summary', authenticate, catchAsync(async (req, res) => {
  const activeFires = await FireEvent.findAll({
    where: { status: { [Op.in]: ['detected', 'processing', 'classified'] } },
    include: [
      { model: Watershed, as: 'watershed', attributes: ['id', 'name'] }
    ],
    order: [['detectedAt', 'DESC']]
  });

  const byStatus = {
    detected: activeFires.filter(f => f.status === 'detected').length,
    processing: activeFires.filter(f => f.status === 'processing').length,
    classified: activeFires.filter(f => f.status === 'classified').length,
  };

  res.json({
    status: 'success',
    data: {
      totalActive: activeFires.length,
      byStatus,
      fires: activeFires
    }
  });
}));

module.exports = router;
