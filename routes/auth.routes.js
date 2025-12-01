const express = require('express');
const router = express.Router();
const { 
    register, 
    verifyOTP, 
    login, 
    getCurrentUser, 
    requestPasswordReset, 
    resetPassword, 
    updateProfile, 
    refreshToken, 
    logout 
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { authValidations } = require('../middleware/validation.middleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (student)
 * @access  Public
 */
router.post('/register', 
    authValidations.register, 
    register
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify OTP and activate account
 * @access  Public
 */
router.post('/verify-otp', 
    authValidations.verifyOTP, 
    verifyOTP
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', 
    authValidations.login, 
    login
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', 
    protect, 
    getCurrentUser
);

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request password reset OTP
 * @access  Public
 */
router.post('/request-password-reset', 
    authValidations.verifyOTP, // Only email validation needed
    requestPasswordReset
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with OTP
 * @access  Public
 */
router.post('/reset-password', 
    resetPassword
);

/**
 * @route   PUT /api/auth/update-profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/update-profile', 
    protect, 
    updateProfile
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (with refresh token)
 */
router.post('/refresh-token', 
    refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', 
    protect, 
    logout
);

module.exports = router;