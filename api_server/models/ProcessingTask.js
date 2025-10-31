const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProcessingTask = sequelize.define('ProcessingTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  watershedId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Watersheds',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  taskType: {
    type: DataTypes.ENUM(
      'satellite_download',
      'image_preprocessing',
      'change_detection',
      'classification',
      'analysis',
      'export'
    ),
    allowNull: false
  },
  taskName: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 100
    }
  },
  currentStep: {
    type: DataTypes.STRING(100)
  },
  totalSteps: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  estimatedDuration: {
    type: DataTypes.INTEGER // in minutes
  },
  actualDuration: {
    type: DataTypes.INTEGER // in minutes
  },
  startedAt: {
    type: DataTypes.DATE
  },
  completedAt: {
    type: DataTypes.DATE
  },
  errorMessage: {
    type: DataTypes.TEXT
  },
  errorDetails: {
    type: DataTypes.JSON
  },
  result: {
    type: DataTypes.JSON
  },
  parameters: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  logs: {
    type: DataTypes.TEXT
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal'
  },
  retryCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  dependencies: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  resourceUsage: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'processing_tasks'
});

ProcessingTask.prototype.updateProgress = function(progress, step = null) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (step) {
    this.currentStep = step;
  }
  return this.save();
};

ProcessingTask.prototype.markCompleted = function(result = null) {
  this.status = 'completed';
  this.progress = 100;
  this.completedAt = new Date();
  if (this.startedAt) {
    this.actualDuration = Math.floor((this.completedAt - this.startedAt) / (1000 * 60));
  }
  if (result) {
    this.result = result;
  }
  return this.save();
};

ProcessingTask.prototype.markFailed = function(errorMessage, errorDetails = null) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  if (errorDetails) {
    this.errorDetails = errorDetails;
  }
  return this.save();
};

ProcessingTask.prototype.start = function() {
  this.status = 'running';
  this.startedAt = new Date();
  return this.save();
};

ProcessingTask.prototype.retry = function() {
  if (this.retryCount < this.maxRetries) {
    this.retryCount += 1;
    this.status = 'pending';
    this.progress = 0;
    this.errorMessage = null;
    this.errorDetails = null;
    return this.save();
  }
  return Promise.reject(new Error('Max retries exceeded'));
};

module.exports = ProcessingTask;
