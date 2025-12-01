const express = require('express');
const router = express.Router();
const { 
    createEvent,
    getAllEvents,
    getPendingEvents,
    getEventById,
    updateEvent,
    deleteEvent,
    approveEvent,
    rejectEvent,
    getUserEvents,
    getEventStats
} = require('../controllers/event.controller');
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { restrictToAdmin, restrictToOwnerOrAdmin } = require('../middleware/admin.middleware');
const { eventValidations } = require('../middleware/validation.middleware');

/**
 * @route   GET /api/events
 * @desc    Get all approved events (public)
 * @access  Public
 */
router.get('/', 
    optionalAuth, // Optional auth to add RSVP status
    getAllEvents
);

/**
 * @route   GET /api/events/pending
 * @desc    Get pending events (admin only)
 * @access  Private/Admin
 */
router.get('/pending', 
    protect, 
    restrictToAdmin, 
    getPendingEvents
);

/**
 * @route   GET /api/events/stats
 * @desc    Get event statistics (admin only)
 * @access  Private/Admin
 */
router.get('/stats', 
    protect, 
    restrictToAdmin, 
    getEventStats
);

/**
 * @route   GET /api/events/my-events
 * @desc    Get current user's events
 * @access  Private
 */
router.get('/my-events', 
    protect, 
    getUserEvents
);

/**
 * @route   GET /api/events/:id
 * @desc    Get event by ID
 * @access  Public (approved) / Private (pending/rejected for owner/admin)
 */
router.get('/:id', 
    optionalAuth, 
    eventValidations.eventIdParam, 
    getEventById
);

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private (Students only)
 */
router.post('/', 
    protect, 
    eventValidations.createEvent, 
    createEvent
);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (Event owner or admin)
 */
router.put('/:id', 
    protect, 
    eventValidations.eventIdParam,
    restrictToOwnerOrAdmin('Event'),
    updateEvent
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (Event owner or admin)
 */
router.delete('/:id', 
    protect, 
    eventValidations.eventIdParam,
    restrictToOwnerOrAdmin('Event'),
    deleteEvent
);

/**
 * @route   PATCH /api/events/:id/approve
 * @desc    Approve event (admin only)
 * @access  Private/Admin
 */
router.patch('/:id/approve', 
    protect, 
    restrictToAdmin,
    eventValidations.eventIdParam,
    approveEvent
);

/**
 * @route   PATCH /api/events/:id/reject
 * @desc    Reject event (admin only)
 * @access  Private/Admin
 */
router.patch('/:id/reject', 
    protect, 
    restrictToAdmin,
    eventValidations.eventIdParam,
    eventValidations.updateEventStatus,
    rejectEvent
);

module.exports = router;