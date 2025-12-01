const AppError = require('../utils/AppError');

/**
 * Middleware to restrict access to admin users only
 */
const restrictToAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return next(new AppError(
            'You do not have permission to perform this action. Admin access required.',
            403,
            'ADMIN_REQUIRED'
        ));
    }
    next();
};

/**
 * Middleware to restrict access to document owner or admin
 * @param {string} model - Model name (without .model.js)
 * @param {string} idParam - Parameter name containing document ID
 * @param {boolean} populateCreatedBy - Whether to populate createdBy field
 */
const restrictToOwnerOrAdmin = (model, idParam = 'id', populateCreatedBy = true) => {
    return async (req, res, next) => {
        try {
            const Model = require(`../models/${model}.model`);
            const docId = req.params[idParam];
            
            if (!docId) {
                return next(new AppError(
                    'Document ID is required',
                    400,
                    'ID_REQUIRED'
                ));
            }
            
            // Build query
            let query = Model.findById(docId);
            
            // Populate createdBy if needed
            if (populateCreatedBy) {
                query = query.populate('createdBy', '_id');
            }
            
            // Find the document
            const document = await query;
            
            if (!document) {
                return next(new AppError(
                    'Document not found',
                    404,
                    'NOT_FOUND'
                ));
            }
            
            // Check if user is admin or owner
            const createdById = document.createdBy?._id || document.createdBy;
            const isOwner = createdById && createdById.toString() === req.userId;
            const isAdmin = req.userRole === 'admin';
            
            if (!isOwner && !isAdmin) {
                return next(new AppError(
                    'You do not have permission to perform this action.',
                    403,
                    'PERMISSION_DENIED'
                ));
            }
            
            // Attach document to request for later use
            req.document = document;
            next();
            
        } catch (error) {
            console.error('Permission check error:', error);
            
            // Handle invalid ObjectId
            if (error.name === 'CastError') {
                return next(new AppError(
                    'Invalid document ID format',
                    400,
                    'INVALID_ID'
                ));
            }
            
            return next(new AppError(
                'Permission check failed',
                500,
                'PERMISSION_CHECK_ERROR'
            ));
        }
    };
};

/**
 * Middleware to check if user is admin (doesn't block, just adds flag)
 */
const isAdmin = (req, res, next) => {
    req.isAdmin = req.userRole === 'admin';
    next();
};

/**
 * Middleware to validate admin operations
 * @param {string[]} allowedActions - Array of allowed action names
 * @param {boolean} requireAction - Whether action parameter is required
 */
const validateAdminAction = (allowedActions = [], requireAction = true) => {
    return (req, res, next) => {
        const action = req.body.action || req.params.action;
        
        // Check if action is required but missing
        if (requireAction && !action) {
            return next(new AppError(
                'Action parameter is required',
                400,
                'ACTION_REQUIRED'
            ));
        }
        
        // If action exists and allowedActions is specified, validate
        if (action && allowedActions.length > 0 && !allowedActions.includes(action)) {
            return next(new AppError(
                `Invalid admin action. Allowed actions: ${allowedActions.join(', ')}`,
                400,
                'INVALID_ADMIN_ACTION'
            ));
        }
        
        next();
    };
};

/**
 * Rate limiting middleware for admin actions
 * @param {number} limit - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 */
const adminRateLimit = (limit = 10, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    // Cleanup interval to prevent memory leaks
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        for (const [adminId, timestamps] of requests.entries()) {
            // Remove old timestamps
            while (timestamps.length && timestamps[0] < windowStart) {
                timestamps.shift();
            }
            // Remove empty arrays
            if (timestamps.length === 0) {
                requests.delete(adminId);
            }
        }
    }, 5 * 60 * 1000); // Clean every 5 minutes
    
    // Store cleanup interval for potential server shutdown
    adminRateLimit.intervals = adminRateLimit.intervals || new Set();
    adminRateLimit.intervals.add(cleanupInterval);
    
    return (req, res, next) => {
        if (req.userRole !== 'admin') {
            return next(); // Only apply to admins
        }
        
        const adminId = req.userId;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!requests.has(adminId)) {
            requests.set(adminId, []);
        }
        
        const userRequests = requests.get(adminId);
        
        // Remove requests outside the time window
        while (userRequests.length && userRequests[0] < windowStart) {
            userRequests.shift();
        }
        
        // Check if limit exceeded
        if (userRequests.length >= limit) {
            return next(new AppError(
                'Too many admin actions. Please try again later.',
                429,
                'RATE_LIMIT_EXCEEDED'
            ));
        }
        
        // Add current request
        userRequests.push(now);
        next();
    };
};

/**
 * Cleanup function for rate limiting intervals (call on server shutdown)
 */
adminRateLimit.cleanup = () => {
    if (adminRateLimit.intervals) {
        for (const interval of adminRateLimit.intervals) {
            clearInterval(interval);
        }
        adminRateLimit.intervals.clear();
    }
};

module.exports = {
    restrictToAdmin,
    restrictToOwnerOrAdmin,
    isAdmin,
    validateAdminAction,
    adminRateLimit
};