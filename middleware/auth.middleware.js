const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const AppError = require('../utils/AppError');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    try {
        let token;
        
        // 1) Check if token exists in headers
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return next(new AppError(
                'You are not logged in. Please log in to access this resource.',
                401,
                'NOT_AUTHENTICATED'
            ));
        }

        // 2) Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const currentUser = await User.findById(decoded.userId);
        if (!currentUser) {
            return next(new AppError(
                'The user belonging to this token no longer exists.',
                401,
                'USER_NOT_FOUND'
            ));
        }

        // 4) Check if user is active
        if (!currentUser.isActive) {
            return next(new AppError(
                'Your account is not active. Please verify your email.',
                403,
                'ACCOUNT_INACTIVE'
            ));
        }

        // 5) Grant access to protected route
        req.userId = currentUser._id;
        req.userEmail = currentUser.email;
        req.userRole = currentUser.role;
        next();
        
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return next(new AppError(
                'Invalid token. Please log in again.',
                401,
                'INVALID_TOKEN'
            ));
        }
        
        if (error.name === 'TokenExpiredError') {
            return next(new AppError(
                'Your token has expired. Please log in again.',
                401,
                'TOKEN_EXPIRED'
            ));
        }

        // Generic error
        return next(new AppError(
            'Authentication failed.',
            401,
            'AUTH_FAILED'
        ));
    }
};

// Optional authentication - doesn't block if no token
const optionalAuth = async (req, res, next) => {
    try {
        let token;
        
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
            
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const currentUser = await User.findById(decoded.userId);
                
                if (currentUser && currentUser.isActive) {
                    req.userId = currentUser._id;
                    req.userEmail = currentUser.email;
                    req.userRole = currentUser.role;
                    req.isAuthenticated = true;
                }
            }
        }
        
        req.isAuthenticated = req.isAuthenticated || false;
        next();
        
    } catch (error) {
        // If token is invalid, just continue without auth
        req.isAuthenticated = false;
        next();
    }
};

// Refresh token middleware
const refreshToken = async (req, res, next) => {
    try {
        const refreshToken = req.headers['x-refresh-token'];
        
        if (!refreshToken) {
            return next(new AppError(
                'Refresh token required',
                401,
                'REFRESH_TOKEN_REQUIRED'
            ));
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.isActive) {
            return next(new AppError(
                'User not found or inactive',
                401,
                'USER_INVALID'
            ));
        }

        // Generate new access token
        const newToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        // Attach new token to response
        res.setHeader('x-new-token', newToken);
        req.userId = user._id;
        req.userRole = user.role;
        next();
        
    } catch (error) {
        return next(new AppError(
            'Invalid refresh token',
            401,
            'INVALID_REFRESH_TOKEN'
        ));
    }
};

module.exports = {
    protect,
    optionalAuth,
    refreshToken
};