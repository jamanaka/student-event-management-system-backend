const express = require("express");
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
  getEventStats,
} = require("../controllers/event.controller");
const { protect, optionalAuth } = require("../middleware/auth.middleware");
const {
  restrictToAdmin,
  restrictToOwnerOrAdmin,
} = require("../middleware/admin.middleware");
const { eventValidations } = require("../middleware/validation.middleware");

// Routes
router.get("/", optionalAuth, getAllEvents);
router.get("/pending", protect, restrictToAdmin, getPendingEvents);
router.get("/stats", protect, restrictToAdmin, getEventStats);
router.get("/my-events", protect, getUserEvents);
router.get("/:id", optionalAuth, eventValidations.eventIdParam, getEventById);
router.post("/", protect, eventValidations.createEvent, createEvent);
router.put(
  "/:id",
  protect,
  eventValidations.eventIdParam,
  restrictToOwnerOrAdmin("Event"),
  updateEvent
);
router.delete(
  "/:id",
  protect,
  eventValidations.eventIdParam,
  restrictToOwnerOrAdmin("Event"),
  deleteEvent
);
router.patch(
  "/:id/approve",
  protect,
  restrictToAdmin,
  eventValidations.eventIdParam,
  approveEvent
);
router.patch(
  "/:id/reject",
  protect,
  restrictToAdmin,
  eventValidations.eventIdParam,
  eventValidations.updateEventStatus,
  rejectEvent
);

module.exports = router;
