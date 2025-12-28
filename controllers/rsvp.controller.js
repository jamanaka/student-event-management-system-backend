const RSVP = require("../models/RSVP.model");
const Event = require("../models/Event.model");
const User = require("../models/User.model");
const AppError = require("../utils/AppError");
const { sendRSVPConfirmationEmail } = require("../utils/emailService");

// Add RSVP to Event
const addRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { numberOfGuests = 0, dietaryPreferences } = req.body;
    const userId = req.userId;

    // Find event
    const event = await Event.findById(eventId);
    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Check if event is approved
    if (event.status !== "approved") {
      return next(
        new AppError(
          "You can only RSVP to approved events",
          400,
          "EVENT_NOT_APPROVED"
        )
      );
    }

    // Check if event is in the past
    if (new Date(event.date) <= new Date()) {
      return next(
        new AppError("Cannot RSVP to past events", 400, "EVENT_PAST")
      );
    }

    // Check if event is full
    const totalGuests = 1 + parseInt(numberOfGuests);
    if (event.currentAttendees + totalGuests > event.capacity) {
      return next(new AppError("Event is at full capacity", 400, "EVENT_FULL"));
    }

    // Check if already RSVPed
    const existingRSVP = await RSVP.findOne({
      event: eventId,
      user: userId,
      status: "attending",
    });

    if (existingRSVP) {
      return next(
        new AppError(
          "You have already RSVPed to this event",
          400,
          "ALREADY_RSVPED"
        )
      );
    }

    // Create RSVP
    const rsvp = new RSVP({
      event: eventId,
      user: userId,
      numberOfGuests: parseInt(numberOfGuests),
      dietaryPreferences,
      status: "attending",
    });

    await rsvp.save();

    // Populate user and event details
    await rsvp.populate("user", "firstName lastName email");
    await rsvp.populate("event", "title date location");

    const user = await User.findById(userId);
    await sendRSVPConfirmationEmail(
      user.email,
      event.title,
      event.date.toLocaleDateString(),
      event.time,
      user.firstName
    );

    res.status(201).json({
      success: true,
      message: "Successfully RSVPed to event",
      data: rsvp,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(
        new AppError(
          "You have already RSVPed to this event",
          400,
          "ALREADY_RSVPED"
        )
      );
    }
    next(error);
  }
};

// Remove RSVP
const removeRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    // Find and delete RSVP
    const rsvp = await RSVP.findOneAndDelete({
      event: eventId,
      user: userId,
      status: "attending",
    });

    if (!rsvp) {
      return next(new AppError("RSVP not found", 404, "RSVP_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      message: "RSVP removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get Event Attendees
const getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get attendees with pagination
    const attendees = await RSVP.find({
      event: eventId,
      status: "attending",
    })
      .populate("user", "firstName lastName email department")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await RSVP.countDocuments({
      event: eventId,
      status: "attending",
    });

    res.status(200).json({
      success: true,
      count: attendees.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: attendees,
    });
  } catch (error) {
    next(error);
  }
};

// Get User's RSVPs
const getUserRSVPs = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10, status = "upcoming" } = req.query;

    // Build query
    const query = { user: userId, status: "attending" };

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get RSVPs with event details
    const rsvps = await RSVP.find(query)
      .populate({
        path: "event",
        match:
          status === "past"
            ? { date: { $lt: new Date() } }
            : { date: { $gte: new Date() } },
        select:
          "title date time location category status currentAttendees capacity",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter out RSVPs where event doesn't match status
    const filteredRSVPs = rsvps.filter((rsvp) => rsvp.event);

    // Get total count
    const totalQuery = { user: userId, status: "attending" };
    if (status === "past") {
      totalQuery["event.date"] = { $lt: new Date() };
    } else {
      totalQuery["event.date"] = { $gte: new Date() };
    }

    const total = await RSVP.countDocuments(totalQuery);

    res.status(200).json({
      success: true,
      count: filteredRSVPs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: filteredRSVPs,
    });
  } catch (error) {
    next(error);
  }
};

// Check RSVP Status
const checkRSVPStatus = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    const rsvp = await RSVP.findOne({
      event: eventId,
      user: userId,
      status: "attending",
    }).populate("event", "title date location");

    res.status(200).json({
      success: true,
      data: {
        hasRSVPed: !!rsvp,
        rsvp: rsvp || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update RSVP (e.g., change number of guests)
const updateRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { numberOfGuests, dietaryPreferences } = req.body;
    const userId = req.userId;

    // Find RSVP
    const rsvp = await RSVP.findOne({
      event: eventId,
      user: userId,
      status: "attending",
    });

    if (!rsvp) {
      return next(new AppError("RSVP not found", 404, "RSVP_NOT_FOUND"));
    }

    // Check capacity if updating guests
    if (numberOfGuests !== undefined) {
      const event = await Event.findById(eventId);
      const guestDiff = parseInt(numberOfGuests) - rsvp.numberOfGuests;

      if (event.currentAttendees + guestDiff > event.capacity) {
        return next(
          new AppError(
            "Cannot add guests, event would exceed capacity",
            400,
            "CAPACITY_EXCEEDED"
          )
        );
      }

      rsvp.numberOfGuests = parseInt(numberOfGuests);
    }

    if (dietaryPreferences !== undefined) {
      rsvp.dietaryPreferences = dietaryPreferences;
    }

    await rsvp.save();
    await rsvp.populate("event", "title date location");

    res.status(200).json({
      success: true,
      message: "RSVP updated successfully",
      data: rsvp,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addRSVP,
  removeRSVP,
  getEventAttendees,
  getUserRSVPs,
  checkRSVPStatus,
  updateRSVP,
};
