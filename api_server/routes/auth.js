const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { catchAsync, AppError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', validateRegister, catchAsync(async (req, res) => {
  const { username, email, password, firstName, lastName, organization } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    where: {
      [email ? 'email' : 'username']: email || username
    }
  });

  if (existingUser) {
    throw new AppError('User with this email or username already exists', 400);
  }

  // Create new user
  const user = await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    organization
  });

  // Generate token
  const token = generateToken(user.id);

  logger.info(`New user registered: ${user.email}`);

  res.status(201).json({
    status: 'success',
    message: 'User registered successfully',
    data: {
      user,
      token
    }
  });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({
    where: { email }
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check password
  const isValidPassword = await user.validatePassword(password);
  if (!isValidPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last login
  await user.update({ lastLogin: new Date() });

  // Generate token
  const token = generateToken(user.id);

  logger.info(`User logged in: ${user.email}`);

  res.json({
    status: 'success',
    message: 'Login successful',
    data: {
      user,
      token
    }
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, catchAsync(async (req, res) => {
  res.json({
    status: 'success',
    data: {
      user: req.user
    }
  });
}));

// @route   PUT /api/auth/me
// @desc    Update current user profile
// @access  Private
router.put('/me', authenticate, catchAsync(async (req, res) => {
  const allowedFields = ['firstName', 'lastName', 'organization'];
  const updates = {};
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  const user = await req.user.update(updates);

  res.json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user
    }
  });
}));

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticate, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
], catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Verify current password
  const isValidPassword = await req.user.validatePassword(currentPassword);
  if (!isValidPassword) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  await req.user.update({ password: newPassword });

  logger.info(`Password changed for user: ${req.user.email}`);

  res.json({
    status: 'success',
    message: 'Password changed successfully'
  });
}));

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);
  
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

module.exports = router;
