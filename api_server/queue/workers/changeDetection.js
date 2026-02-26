const { ProcessingTask, ChangeDetection, Notification } = require('../../models');
const { executePython } = require('../pythonBridge');
const { emitProgressUpdate, emitTaskCompleted, emitUserNotification } = require('../../services/socketService');
const { logger } = require('../../utils/logger');

const handleChangeDetection = async (job) => {
  const { taskId, changeDetectionId, userId } = job.data;
  logger.info(`Processing change detection job: ${taskId}`);

  const task = await ProcessingTask.findByPk(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  await task.start();
  emitProgressUpdate(taskId, { progress: 5, step: 'Loading images' });

  try {
    const result = await executePython('change_detection.py', {
      taskId,
      changeDetectionId,
      parameters: task.parameters
    }, {
      timeout: 900000, // 15 minutes for change detection
      onProgress: (progress) => {
        emitProgressUpdate(taskId, { progress, step: `Analyzing (${progress}%)` });
        task.updateProgress(progress);
      }
    });

    // Update change detection record with results
    if (changeDetectionId) {
      await ChangeDetection.update(
        {
          processingStatus: 'completed',
          statistics: result.statistics || {},
          metadata: { ...result.metadata, geojsonUrl: result.geojsonUrl }
        },
        { where: { id: changeDetectionId } }
      );
    }

    await task.markCompleted(result);
    emitTaskCompleted(taskId, result);

    await Notification.create({
      userId,
      type: 'job',
      title: 'Change Detection Complete',
      message: `Change detection analysis finished. ${result.changesFound || 0} changes detected.`,
      linkTo: `/map`,
      metadata: { taskId, changeDetectionId }
    });
    emitUserNotification(userId, {
      type: 'job',
      title: 'Change Detection Complete',
      message: `Analysis finished. ${result.changesFound || 0} changes detected.`
    });

    logger.info(`Change detection complete: ${taskId}`);
  } catch (error) {
    await task.markFailed(error.message);
    logger.error(`Change detection failed: ${taskId}`, error);

    await Notification.create({
      userId,
      type: 'job',
      title: 'Change Detection Failed',
      message: `Analysis failed: ${error.message}`,
      linkTo: `/progress`,
      metadata: { taskId, error: error.message }
    });
    emitUserNotification(userId, {
      type: 'job',
      title: 'Change Detection Failed',
      message: `Analysis failed: ${error.message}`
    });
  }
};

module.exports = handleChangeDetection;
