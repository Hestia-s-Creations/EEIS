const { logger } = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

let io = null;

const initSocket = (socketIo) => {
  io = socketIo;

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.isActive) {
        return next(new Error('Invalid user'));
      }

      socket.user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`User ${user.username} connected via socket`);

    // Join user to their personal room
    socket.join(`user:${user.id}`);

    // Join admin users to admin room
    if (user.role === 'admin') {
      socket.join('admin');
    }

    // Handle subscription to watershed updates
    socket.on('subscribe_watershed', (watershedId) => {
      socket.join(`watershed:${watershedId}`);
      logger.info(`User ${user.username} subscribed to watershed ${watershedId}`);
    });

    // Handle unsubscription from watershed updates
    socket.on('unsubscribe_watershed', (watershedId) => {
      socket.leave(`watershed:${watershedId}`);
      logger.info(`User ${user.username} unsubscribed from watershed ${watershedId}`);
    });

    // Handle subscription to processing task updates
    socket.on('subscribe_task', (taskId) => {
      socket.join(`task:${taskId}`);
      logger.info(`User ${user.username} subscribed to task ${taskId}`);
    });

    // Handle unsubscription from processing task updates
    socket.on('unsubscribe_task', (taskId) => {
      socket.leave(`task:${taskId}`);
      logger.info(`User ${user.username} unsubscribed from task ${taskId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User ${user.username} disconnected from socket`);
    });
  });

  logger.info('Socket.IO service initialized');
};

const emitProgressUpdate = (taskId, progressData) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(`task:${taskId}`).emit('progress_update', {
    taskId,
    ...progressData,
    timestamp: new Date()
  });

  logger.debug(`Progress update emitted for task ${taskId}`);
};

const emitTaskCompleted = (taskId, result) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(`task:${taskId}`).emit('task_completed', {
    taskId,
    result,
    timestamp: new Date()
  });

  logger.info(`Task completion emitted for task ${taskId}`);
};

const emitTaskFailed = (taskId, error) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(`task:${taskId}`).emit('task_failed', {
    taskId,
    error,
    timestamp: new Date()
  });

  logger.error(`Task failure emitted for task ${taskId}`);
};

const emitWatershedUpdate = (watershedId, updateData) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(`watershed:${watershedId}`).emit('watershed_update', {
    watershedId,
    ...updateData,
    timestamp: new Date()
  });

  logger.debug(`Watershed update emitted for watershed ${watershedId}`);
};

const emitUserNotification = (userId, notification) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(`user:${userId}`).emit('notification', {
    ...notification,
    timestamp: new Date(),
    id: require('uuid').v4()
  });

  logger.debug(`Notification emitted for user ${userId}`);
};

const emitSystemAlert = (alert) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  // Send to all connected users
  io.emit('system_alert', {
    ...alert,
    timestamp: new Date(),
    id: require('uuid').v4()
  });

  logger.warn(`System alert emitted: ${alert.message}`);
};

const emitRealTimeData = (type, data) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.emit('real_time_data', {
    type,
    data,
    timestamp: new Date()
  });
};

const getConnectedUsers = () => {
  if (!io) {
    return [];
  }

  const connectedUsers = [];
  io.sockets.sockets.forEach((socket) => {
    if (socket.user) {
      connectedUsers.push({
        id: socket.user.id,
        username: socket.user.username,
        role: socket.user.role,
        connectedAt: socket.handshake.time
      });
    }
  });

  return connectedUsers;
};

const broadcastToRole = (role, event, data) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  io.to(role).emit(event, {
    ...data,
    timestamp: new Date()
  });

  logger.debug(`Broadcast emitted to role ${role}: ${event}`);
};

module.exports = {
  initSocket,
  emitProgressUpdate,
  emitTaskCompleted,
  emitTaskFailed,
  emitWatershedUpdate,
  emitUserNotification,
  emitSystemAlert,
  emitRealTimeData,
  getConnectedUsers,
  broadcastToRole
};
