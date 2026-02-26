const { Watershed, FireEvent } = require('../../models');
const { executePython } = require('../pythonBridge');
const { getBoss } = require('../boss');
const { emitSystemAlert } = require('../../services/socketService');
const { logger } = require('../../utils/logger');
const { Op } = require('sequelize');

/**
 * FIRMS Polling Worker
 *
 * Scheduled job that polls NASA FIRMS for active fire hotspots within
 * monitored watersheds. When hotspots are found:
 * 1. Creates FireEvent records
 * 2. Queues a burn_severity change detection job
 * 3. Sends system-wide fire alert notifications
 */
const handleFirmsPolling = async (job) => {
  logger.info('Running FIRMS fire hotspot polling');

  const firmsMapKey = process.env.FIRMS_MAP_KEY;
  if (!firmsMapKey) {
    logger.warn('FIRMS_MAP_KEY not configured, skipping fire polling');
    return;
  }

  // Get all active watersheds with boundaries
  const watersheds = await Watershed.findAll({
    where: { status: 'active' },
    attributes: ['id', 'name', 'boundaries']
  });

  if (watersheds.length === 0) {
    logger.info('No active watersheds to monitor for fires');
    return;
  }

  // Build watershed bbox list from boundaries
  const watershedInputs = [];
  for (const ws of watersheds) {
    const bbox = extractBbox(ws.boundaries);
    if (bbox) {
      watershedInputs.push({ id: ws.id, bbox });
    }
  }

  if (watershedInputs.length === 0) {
    logger.info('No watersheds with valid boundaries for FIRMS query');
    return;
  }

  try {
    // Call Python FIRMS client
    const result = await executePython('fire_detection/firms_client.py', {
      map_key: firmsMapKey,
      watersheds: watershedInputs,
      days: 2
    }, { timeout: 120000 }); // 2 min timeout

    if (!result.success) {
      logger.error(`FIRMS polling failed: ${result.error}`);
      return;
    }

    logger.info(`FIRMS polling: ${result.total_hotspots} hotspots found`);

    // Process each watershed's hotspots
    let newEvents = 0;
    for (const event of (result.fire_events || [])) {
      const wsId = event.watershed_id;
      const hotspots = event.hotspots || [];

      for (const hotspot of hotspots) {
        // Check for duplicate (same location within last 24 hours)
        const existing = await FireEvent.findOne({
          where: {
            watershedId: wsId,
            latitude: hotspot.latitude,
            longitude: hotspot.longitude,
            detectedAt: {
              [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
          }
        });

        if (existing) continue;

        // Create new fire event
        const fireEvent = await FireEvent.create({
          watershedId: wsId,
          source: 'FIRMS',
          latitude: hotspot.latitude,
          longitude: hotspot.longitude,
          confidence: hotspot.confidence === 'high' ? 90 : hotspot.confidence === 'nominal' ? 50 : 20,
          frp: hotspot.frp || null,
          status: 'detected',
          metadata: {
            brightness: hotspot.brightness,
            satellite: hotspot.satellite,
            acq_date: hotspot.acq_date,
            acq_time: hotspot.acq_time,
            daynight: hotspot.daynight,
          }
        });

        newEvents++;
        logger.info(`New fire event: ${fireEvent.id} in watershed ${wsId} at [${hotspot.latitude}, ${hotspot.longitude}]`);

        // Queue burn severity analysis
        try {
          const boss = getBoss();
          await boss.send('change-detection', {
            fireEventId: fireEvent.id,
            watershedId: wsId,
            parameters: {
              algorithm: 'burn_severity',
              fireLocation: { lat: hotspot.latitude, lon: hotspot.longitude },
            }
          });
          await fireEvent.update({ status: 'processing' });
        } catch (queueError) {
          logger.warn(`Could not queue severity analysis for fire ${fireEvent.id}: ${queueError.message}`);
        }
      }

      // Send system alert for new fires in this watershed
      if (hotspots.length > 0) {
        const ws = watersheds.find(w => w.id === wsId);
        emitSystemAlert({
          type: 'fire_detected',
          severity: 'critical',
          title: `Fire Detected: ${ws?.name || wsId}`,
          message: `${hotspots.length} fire hotspot(s) detected in ${ws?.name || 'watershed'}. Burn severity analysis queued.`,
          metadata: { watershedId: wsId, hotspotCount: hotspots.length }
        });
      }
    }

    logger.info(`FIRMS polling complete: ${newEvents} new fire events created`);
  } catch (error) {
    logger.error('FIRMS polling error:', error);
  }
};

/**
 * Extract bounding box from GeoJSON boundaries.
 * Returns { west, south, east, north } or null.
 */
function extractBbox(boundaries) {
  if (!boundaries) return null;

  try {
    let coords = [];

    if (boundaries.type === 'Polygon') {
      coords = boundaries.coordinates[0];
    } else if (boundaries.type === 'MultiPolygon') {
      for (const poly of boundaries.coordinates) {
        coords = coords.concat(poly[0]);
      }
    } else if (boundaries.bbox) {
      return {
        west: boundaries.bbox[0],
        south: boundaries.bbox[1],
        east: boundaries.bbox[2],
        north: boundaries.bbox[3],
      };
    } else {
      return null;
    }

    if (coords.length === 0) return null;

    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    return {
      west: Math.min(...lons),
      south: Math.min(...lats),
      east: Math.max(...lons),
      north: Math.max(...lats),
    };
  } catch (e) {
    return null;
  }
}

module.exports = handleFirmsPolling;
