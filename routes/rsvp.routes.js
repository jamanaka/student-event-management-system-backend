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

// Routes
router.get("/my-rsvps", protect, getUserRSVPs);
router.get(
  "/check/:eventId",
  protect,
  eventValidations.eventIdParamForRSVP,
  checkRSVPStatus
);
router.post(
  "/:eventId",
  protect,
  rsvpValidations.createRSVP,
  addRSVP
);
router.put("/:eventId", protect, eventValidations.eventIdParamForRSVP, updateRSVP);
router.delete("/:eventId", protect, eventValidations.eventIdParamForRSVP, removeRSVP);
router.get(
  "/event/:eventId/attendees",
  eventValidations.eventIdParamForRSVP,
  getEventAttendees
);

module.exports = router;
