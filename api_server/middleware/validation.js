const { body, validationResult, param } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Auth validations
const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must not exceed 50 characters'),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name must not exceed 50 characters'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Watershed validations
const validateWatershed = [
  body('name')
    .notEmpty()
    .withMessage('Watershed name is required')
    .isLength({ max: 100 })
    .withMessage('Watershed name must not exceed 100 characters'),
  body('code')
    .notEmpty()
    .withMessage('Watershed code is required')
    .isLength({ max: 20 })
    .withMessage('Watershed code must not exceed 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Watershed code can only contain uppercase letters, numbers, and underscores'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
  body('area')
    .isFloat({ min: 0 })
    .withMessage('Area must be a positive number'),
  body('centroid')
    .notEmpty()
    .withMessage('Centroid coordinates are required'),
  body('boundaries')
    .notEmpty()
    .withMessage('Watershed boundaries are required'),
  body('soilType')
    .optional()
    .isIn(['clay', 'sandy', 'loam', 'silt', 'mixed'])
    .withMessage('Invalid soil type'),
  body('status')
    .optional()
    .isIn(['active', 'archived', 'monitoring'])
    .withMessage('Invalid status'),
  handleValidationErrors
];

// Satellite data validations
const validateSatelliteData = [
  body('watershedId')
    .isUUID()
    .withMessage('Valid watershed ID is required'),
  body('satellite')
    .isIn(['landsat8', 'landsat9', 'sentinel2', 'modis'])
    .withMessage('Invalid satellite type'),
  body('sensor')
    .notEmpty()
    .withMessage('Sensor information is required'),
  body('acquisitionDate')
    .isISO8601()
    .withMessage('Valid acquisition date is required'),
  body('cloudCover')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Cloud cover must be between 0 and 100'),
  body('sceneId')
    .notEmpty()
    .withMessage('Scene ID is required'),
  body('path')
    .isInt({ min: 1, max: 233 })
    .withMessage('Path must be between 1 and 233'),
  body('row')
    .isInt({ min: 1, max: 248 })
    .withMessage('Row must be between 1 and 248'),
  handleValidationErrors
];

// Change detection validations
const validateChangeDetection = [
  body('watershedId')
    .isUUID()
    .withMessage('Valid watershed ID is required'),
  body('name')
    .notEmpty()
    .withMessage('Change detection name is required')
    .isLength({ max: 100 })
    .withMessage('Name must not exceed 100 characters'),
  body('baselineImageId')
    .isUUID()
    .withMessage('Valid baseline image ID is required'),
  body('comparisonImageId')
    .isUUID()
    .withMessage('Valid comparison image ID is required'),
  body('algorithm')
    .isIn([
      'ndvi_difference',
      'ndwi_difference',
      'ndbi_difference',
      'pca_change',
      'image_difference',
      'change_vector_analysis',
      'machine_learning'
    ])
    .withMessage('Invalid change detection algorithm'),
  handleValidationErrors
];

// Processing task validations
const validateProcessingTask = [
  body('watershedId')
    .isUUID()
    .withMessage('Valid watershed ID is required'),
  body('taskType')
    .isIn([
      'satellite_download',
      'image_preprocessing',
      'change_detection',
      'classification',
      'analysis',
      'export'
    ])
    .withMessage('Invalid task type'),
  body('taskName')
    .notEmpty()
    .withMessage('Task name is required')
    .isLength({ max: 100 })
    .withMessage('Task name must not exceed 100 characters'),
  handleValidationErrors
];

// UUID parameter validations
const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateWatershed,
  validateSatelliteData,
  validateChangeDetection,
  validateProcessingTask,
  validateUUID
};
