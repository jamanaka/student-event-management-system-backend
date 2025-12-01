const express = require("express");
const router = express.Router();
const {
  addRSVP,
  removeRSVP,
  getEventAttendees,
  getUserRSVPs,
  checkRSVPStatus,
  updateRSVP,
} = require("../controllers/rsvp.controller");
const { protect } = require("../middleware/auth.middleware");
const {
  eventValidations,
  rsvpValidations,
} = require("../middleware/validation.middleware");

/**
 * @route   GET /api/rsvp/my-rsvps
 * @desc    Get current user's RSVPs
 * @access  Private
 */
router.get("/my-rsvps", protect, getUserRSVPs);

/**
 * @route   GET /api/rsvp/check/:eventId
 * @desc    Check if user has RSVPed to event
 * @access  Private
 */
router.get(
  "/check/:eventId",
  protect,
  eventValidations.eventIdParam,
  checkRSVPStatus
);

/**
 * @route   POST /api/rsvp/:eventId
 * @desc    RSVP to an event
 * @access  Private
 */
router.post(
  "/:eventId",
  protect,
  eventValidations.eventIdParam,
  rsvpValidations.createRSVP,
  addRSVP
);

/**
 * @route   PUT /api/rsvp/:eventId
 * @desc    Update RSVP
 * @access  Private
 */
router.put("/:eventId", protect, eventValidations.eventIdParam, updateRSVP);

/**
 * @route   DELETE /api/rsvp/:eventId
 * @desc    Remove RSVP from event
 * @access  Private
 */
router.delete("/:eventId", protect, eventValidations.eventIdParam, removeRSVP);

/**
 * @route   GET /api/rsvp/event/:eventId/attendees
 * @desc    Get event attendees
 * @access  Public
 */
router.get(
  "/event/:eventId/attendees",
  eventValidations.eventIdParam,
  getEventAttendees
);

module.exports = router;
