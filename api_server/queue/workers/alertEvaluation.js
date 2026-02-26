const { AlertRule, Alert, Watershed, Notification } = require('../../models');
const { emitUserNotification, emitSystemAlert } = require('../../services/socketService');
const { logger } = require('../../utils/logger');
const { Op } = require('sequelize');

const handleAlertEvaluation = async (job) => {
  logger.info('Running alert rule evaluation');

  const rules = await AlertRule.findAll({
    where: { enabled: true },
    include: [{ model: Watershed, as: 'watershed' }]
  });

  let triggered = 0;

  for (const rule of rules) {
    try {
      // Check cooldown
      if (rule.lastTriggeredAt) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (Date.now() - new Date(rule.lastTriggeredAt).getTime() < cooldownMs) {
          continue; // Skip, still in cooldown
        }
      }

      // Evaluate the rule based on metric type
      const shouldTrigger = await evaluateRule(rule);

      if (shouldTrigger.triggered) {
        // Create alert
        const alert = await Alert.create({
          alertRuleId: rule.id,
          watershedId: rule.watershedId,
          type: rule.metric,
          severity: rule.severity,
          status: 'active',
          message: `${rule.name}: ${rule.metric} is ${shouldTrigger.value} (threshold: ${rule.condition} ${rule.threshold})`,
          value: shouldTrigger.value,
          metadata: { ruleId: rule.id, ruleName: rule.name }
        });

        // Update rule trigger info
        await rule.update({
          lastTriggeredAt: new Date(),
          triggerCount: rule.triggerCount + 1
        });

        // Create notification
        if (rule.notifyInApp) {
          await Notification.create({
            userId: rule.userId,
            type: 'alert',
            title: `Alert: ${rule.name}`,
            message: alert.message,
            linkTo: `/alerts`,
            metadata: { alertId: alert.id, ruleId: rule.id }
          });
          emitUserNotification(rule.userId, {
            type: 'alert',
            title: `Alert: ${rule.name}`,
            message: alert.message,
            severity: rule.severity
          });
        }

        triggered++;
        logger.info(`Alert rule triggered: ${rule.name} (value: ${shouldTrigger.value})`);
      }
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.id}: ${error.message}`);
    }
  }

  logger.info(`Alert evaluation complete: ${triggered} alerts triggered out of ${rules.length} rules`);
};

async function evaluateRule(rule) {
  const { Watershed, ChangeDetection } = require('../../models');
  const { sequelize } = require('../../config/database');

  let value = null;

  switch (rule.metric) {
    case 'health_score':
      if (rule.watershedId) {
        const ws = await Watershed.findByPk(rule.watershedId);
        value = ws?.healthScore || 75;
      }
      break;

    case 'change_magnitude':
      if (rule.watershedId) {
        const recent = await ChangeDetection.count({
          where: {
            watershedId: rule.watershedId,
            createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        });
        value = recent;
      }
      break;

    case 'burn_severity':
      if (rule.watershedId) {
        // Find most recent change detection with burn severity data
        const latestCD = await ChangeDetection.findOne({
          where: {
            watershedId: rule.watershedId,
            algorithm: 'burn_severity',
          },
          order: [['createdAt', 'DESC']],
        });
        if (latestCD?.statistics?.burn_severity) {
          value = latestCD.statistics.burn_severity.high_severity_percentage ?? 0;
        } else if (latestCD?.metadata?.burn_severity) {
          value = latestCD.metadata.burn_severity.high_severity_percentage ?? 0;
        }
      }
      break;

    default:
      // For other metrics, return not triggered
      return { triggered: false, value: null };
  }

  if (value === null) return { triggered: false, value: null };

  const triggered = evaluateCondition(value, rule.condition, rule.threshold, rule.thresholdMax);
  return { triggered, value };
}

function evaluateCondition(value, condition, threshold, thresholdMax) {
  switch (condition) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
    case 'between': return value >= threshold && value <= (thresholdMax || threshold);
    default: return false;
  }
}

module.exports = handleAlertEvaluation;
