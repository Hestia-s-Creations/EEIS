const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const watershedRoutes = require('./routes/watersheds');
const satelliteRoutes = require('./routes/satellites');
const changeDetectionRoutes = require('./routes/change-detection');
const spatialRoutes = require('./routes/spatial');
const progressRoutes = require('./routes/progress');
const analyticsRoutes = require('./routes/analytics');
const alertsRoutes = require('./routes/alerts');
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');
const satelliteSearchRoutes = require('./routes/satellite');
const reportsRoutes = require('./routes/reports');
const mapRoutes = require('./routes/map');
const firesRoutes = require('./routes/fires');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const { initSocket } = require('./services/socketService');
const { initDatabase } = require('./config/database');
const { initBoss, stopBoss } = require('./queue/boss');

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOrigins = (process.env.CLIENT_URL || 'http://localhost:6969').split(',');
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Compression and logging
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/watersheds', watershedRoutes);
app.use('/api/satellites', satelliteRoutes);
app.use('/api/change-detection', changeDetectionRoutes);
app.use('/api/spatial', spatialRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/satellite', satelliteSearchRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/fires', firesRoutes);

// Socket.IO initialization
initSocket(io);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    error: {
      code: 404,
      message: `Route ${req.originalUrl} not found`,
      details: null
    }
  });
});

const PORT = process.env.PORT || 5000;

// Initialize database and start server
// Register job queue workers
const registerWorkers = async (boss) => {
  const handleSatelliteProcess = require('./queue/workers/satelliteProcess');
  const handleChangeDetection = require('./queue/workers/changeDetection');
  const handleReportGeneration = require('./queue/workers/reportGeneration');
  const handleAlertEvaluation = require('./queue/workers/alertEvaluation');
  const handleFirmsPolling = require('./queue/workers/firmsPolling');

  await boss.work('satellite-process', handleSatelliteProcess);
  await boss.work('change-detection', handleChangeDetection);
  await boss.work('report-generation', handleReportGeneration);
  await boss.work('alert-evaluation', handleAlertEvaluation);
  await boss.work('firms-polling', handleFirmsPolling);

  // Schedule recurring alert evaluation every 5 minutes
  await boss.schedule('alert-evaluation', '*/5 * * * *', {}, { retryLimit: 1 });

  // Schedule FIRMS fire hotspot polling every 6 hours
  if (process.env.FIRMS_MAP_KEY) {
    await boss.schedule('firms-polling', '0 */6 * * *', {}, { retryLimit: 1 });
    logger.info('FIRMS fire polling scheduled (every 6 hours)');
  } else {
    logger.info('FIRMS_MAP_KEY not set, fire polling disabled');
  }

  logger.info('Job queue workers registered');
};

const startServer = async () => {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    // Initialize pg-boss job queue
    try {
      const boss = await initBoss();
      await registerWorkers(boss);
      logger.info('Job queue initialized successfully');
    } catch (queueError) {
      logger.warn('Job queue initialization failed (non-fatal):', queueError.message);
    }

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Stop pg-boss queue
    try {
      await stopBoss();
      logger.info('Job queue stopped');
    } catch (e) {
      logger.warn('Error stopping job queue:', e.message);
    }

    process.exit(0);
  });

  // Force shutdown after 30s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = { app, server, io };
