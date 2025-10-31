const express = require('express');
const { ProcessingTask, Watershed, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

// @route   GET /api/progress/tasks
// @desc    Get user's processing tasks
// @access  Private
router.get('/tasks', authenticate, catchAsync(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    status,
    taskType,
    watershedId,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = req.query;

  const offset = (page - 1) * limit;
  const whereClause = { userId: req.user.id };

  // Apply filters
  if (status) {
    whereClause.status = status;
  }

  if (taskType) {
    whereClause.taskType = taskType;
  }

  if (watershedId) {
    whereClause.watershedId = watershedId;
  }

  const tasks = await ProcessingTask.findAndCountAll({
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
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }
    ]
  });

  // Calculate estimated time remaining for running tasks
  const runningTasks = tasks.rows.filter(task => task.status === 'running' && task.startedAt);
  const updatedTasks = runningTasks.map(task => {
    if (task.estimatedDuration && task.progress > 0) {
      const elapsed = (new Date() - new Date(task.startedAt)) / (1000 * 60); // minutes
      const estimatedTotal = task.estimatedDuration;
      const remaining = Math.max(0, estimatedTotal - elapsed);
      task.dataValues.estimatedTimeRemaining = remaining;
    }
    return task;
  });

  res.json({
    status: 'success',
    data: {
      tasks: updatedTasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(tasks.count / limit),
        totalItems: tasks.count,
        itemsPerPage: parseInt(limit)
      }
    }
  });
}));

// @route   GET /api/progress/tasks/:id
// @desc    Get single processing task
// @access  Private
router.get('/tasks/:id', authenticate, catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id, {
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }
    ]
  });

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  // Check if user can access this task
  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to view this task', 403);
  }

  // Calculate additional metrics
  let metrics = {};
  if (task.status === 'running' && task.startedAt) {
    const elapsed = (new Date() - new Date(task.startedAt)) / (1000 * 60); // minutes
    metrics.elapsedTime = elapsed;
    
    if (task.estimatedDuration) {
      metrics.estimatedTimeRemaining = Math.max(0, task.estimatedDuration - elapsed);
      metrics.estimatedCompletionTime = new Date(Date.now() + metrics.estimatedTimeRemaining * 60 * 1000);
    }
  }

  res.json({
    status: 'success',
    data: {
      task,
      metrics
    }
  });
}));

// @route   POST /api/progress/tasks
// @desc    Create new processing task
// @access  Private (Admin, Researcher, Analyst)
router.post('/tasks', authenticate, authorize('admin', 'researcher', 'analyst'), catchAsync(async (req, res) => {
  const { watershedId, taskType, taskName, description, parameters = {}, priority = 'normal' } = req.body;

  if (!watershedId || !taskType || !taskName) {
    throw new AppError('Watershed ID, task type, and task name are required', 400);
  }

  // Verify watershed exists
  const watershed = await Watershed.findByPk(watershedId);
  if (!watershed) {
    throw new AppError('Watershed not found', 404);
  }

  const task = await ProcessingTask.create({
    watershedId,
    userId: req.user.id,
    taskType,
    taskName,
    description,
    parameters,
    priority
  });

  logger.info(`Processing task created: ${task.taskName} (${task.id}) by user ${req.user.username}`);

  res.status(201).json({
    status: 'success',
    message: 'Processing task created successfully',
    data: {
      task
    }
  });
}));

// @route   PUT /api/progress/tasks/:id/progress
// @desc    Update task progress
// @access  Private (Admin, Researcher)
router.put('/tasks/:id/progress', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id);

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this task', 403);
  }

  const { progress, step, status } = req.body;

  if (progress !== undefined) {
    await task.updateProgress(progress, step || task.currentStep);
  }

  if (status) {
    await task.update({ status, currentStep: step || task.currentStep });
  }

  logger.info(`Task progress updated: ${task.taskName} (${task.id}) - ${progress}%`);

  res.json({
    status: 'success',
    message: 'Task progress updated successfully',
    data: {
      task
    }
  });
}));

// @route   POST /api/progress/tasks/:id/complete
// @desc    Mark task as completed
// @access  Private (Admin, Researcher)
router.post('/tasks/:id/complete', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id);

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this task', 403);
  }

  const { result } = req.body;
  await task.markCompleted(result);

  logger.info(`Task completed: ${task.taskName} (${task.id})`);

  res.json({
    status: 'success',
    message: 'Task marked as completed',
    data: {
      task
    }
  });
}));

// @route   POST /api/progress/tasks/:id/fail
// @desc    Mark task as failed
// @access  Private (Admin, Researcher)
router.post('/tasks/:id/fail', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id);

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this task', 403);
  }

  const { errorMessage, errorDetails } = req.body;
  await task.markFailed(errorMessage, errorDetails);

  logger.error(`Task failed: ${task.taskName} (${task.id}) - ${errorMessage}`);

  res.json({
    status: 'success',
    message: 'Task marked as failed',
    data: {
      task
    }
  });
}));

// @route   POST /api/progress/tasks/:id/retry
// @desc    Retry failed task
// @access  Private (Admin, Researcher)
router.post('/tasks/:id/retry', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id);

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this task', 403);
  }

  if (task.status !== 'failed') {
    throw new AppError('Only failed tasks can be retried', 400);
  }

  await task.retry();

  logger.info(`Task retried: ${task.taskName} (${task.id})`);

  res.json({
    status: 'success',
    message: 'Task queued for retry',
    data: {
      task
    }
  });
}));

// @route   DELETE /api/progress/tasks/:id
// @desc    Cancel/delete processing task
// @access  Private (Admin, Researcher)
router.delete('/tasks/:id', authenticate, authorize('admin', 'researcher'), catchAsync(async (req, res) => {
  const task = await ProcessingTask.findByPk(req.params.id);

  if (!task) {
    throw new AppError('Processing task not found', 404);
  }

  if (task.userId !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this task', 403);
  }

  if (task.status === 'completed') {
    throw new AppError('Cannot delete completed tasks', 400);
  }

  await task.update({ status: 'cancelled' });

  logger.info(`Task cancelled: ${task.taskName} (${task.id})`);

  res.json({
    status: 'success',
    message: 'Task cancelled successfully',
    data: {
      task
    }
  });
}));

// @route   GET /api/progress/statistics
// @desc    Get processing statistics
// @access  Private
router.get('/statistics', authenticate, catchAsync(async (req, res) => {
  const whereClause = req.user.role === 'admin' ? {} : { userId: req.user.id };

  const taskStats = await ProcessingTask.findAll({
    where: whereClause,
    attributes: [
      'status',
      'taskType',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('actualDuration')), 'avgDuration']
    ],
    group: ['status', 'taskType']
  });

  const overallStats = await ProcessingTask.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTasks'],
      [
        sequelize.fn('COUNT', 
          sequelize.where(sequelize.col('status'), '=', 'completed')
        ), 
        'completedTasks'
      ],
      [
        sequelize.fn('COUNT', 
          sequelize.where(sequelize.col('status'), '=', 'running')
        ), 
        'runningTasks'
      ]
    ]
  });

  const recentActivity = await ProcessingTask.findAll({
    where: {
      ...whereClause,
      updatedAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    },
    attributes: ['id', 'taskName', 'taskType', 'status', 'progress', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    limit: 10
  });

  res.json({
    status: 'success',
    data: {
      byStatusAndType: taskStats,
      overall: overallStats[0],
      recentActivity
    }
  });
}));

// @route   GET /api/progress/queue
// @desc    Get processing queue
// @access  Private (Admin)
router.get('/queue', authenticate, authorize('admin'), catchAsync(async (req, res) => {
  const queue = await ProcessingTask.findAll({
    where: {
      status: 'pending'
    },
    order: [
      ['priority', 'DESC'],
      ['createdAt', 'ASC']
    ],
    include: [
      {
        model: Watershed,
        as: 'watershed',
        attributes: ['id', 'name', 'code']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }
    ]
  });

  res.json({
    status: 'success',
    data: {
      queue,
      pendingCount: queue.length
    }
  });
}));

module.exports = router;
