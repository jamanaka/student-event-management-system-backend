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
    const userRole = req.userRole;

    // Admins cannot RSVP to events
    if (userRole === "admin") {
      return next(
        new AppError(
          "Administrators cannot RSVP to events",
          403,
          "ADMIN_CANNOT_RSVP"
        )
      );
    }

    // Find event
    const event = await Event.findById(eventId);
    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Check if user is the event creator
    const isEventCreator = event.createdBy.toString() === userId;
    
    // Event creators can RSVP to their own events (they're organizing it, so they're attending)
    // This allows them to bring guests and be counted in the attendee list

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

    // Get actual attendee count from RSVPs (more accurate than currentAttendees field)
    const actualAttendeeCount = await RSVP.getActualAttendeeCount(eventId);
    const totalGuests = 1 + parseInt(numberOfGuests);
    
    // Check if event is full
    if (actualAttendeeCount + totalGuests > event.capacity) {
      return next(new AppError("Event is at full capacity", 400, "EVENT_FULL"));
    }

    // Check if user already has an RSVP (any status)
    const existingRSVP = await RSVP.getUserRSVP(eventId, userId);

    if (existingRSVP) {
      // If already attending, return error
      if (existingRSVP.status === "attending") {
        return next(
          new AppError(
            "You have already RSVPed to this event",
            400,
            "ALREADY_RSVPED"
          )
        );
      }
      // If cancelled or waitlisted, update to attending
      existingRSVP.status = "attending";
      existingRSVP.numberOfGuests = parseInt(numberOfGuests);
      existingRSVP.dietaryPreferences = dietaryPreferences;
      await existingRSVP.save();
      
      // Populate and return
      await existingRSVP.populate("user", "firstName lastName email");
      await existingRSVP.populate("event", "title date location");

      const user = await User.findById(userId);
      await sendRSVPConfirmationEmail(
        user.email,
        event.title,
        event.date.toLocaleDateString(),
        event.time,
        user.firstName
      );

      return res.status(200).json({
        success: true,
        message: "RSVP reactivated successfully",
        data: existingRSVP,
      });
    }

    // Create new RSVP
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

// Remove RSVP (cancel it, don't delete to maintain history)
const removeRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    // Find RSVP (any status, but we'll only cancel if attending or waitlisted)
    const rsvp = await RSVP.findOne({
      event: eventId,
      user: userId,
    });

    if (!rsvp) {
      return next(new AppError("RSVP not found", 404, "RSVP_NOT_FOUND"));
    }

    // If already cancelled, return success
    if (rsvp.status === "cancelled") {
      return res.status(200).json({
        success: true,
        message: "RSVP already cancelled",
      });
    }

    // Update status to cancelled (pre-save hook will handle attendee count)
    rsvp.status = "cancelled";
    await rsvp.save();

    res.status(200).json({
      success: true,
      message: "RSVP cancelled successfully",
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
    const { page = 1, limit = 100, status } = req.query; // Don't default status - let frontend filter

    console.log('[getUserRSVPs] Request received:', { userId, page, limit, status });

    // Build query - get all attending RSVPs for the user
    const query = { user: userId, status: "attending" };
    console.log('[getUserRSVPs] Query:', JSON.stringify(query));

    // Get all RSVPs with event details (no date filtering in populate)
    const allRSVPs = await RSVP.find(query)
      .populate({
        path: "event",
        select: "title description date time location category status currentAttendees capacity imageUrl createdBy",
      })
      .sort({ createdAt: -1 });

    console.log('[getUserRSVPs] Found RSVPs:', allRSVPs.length);
    console.log('[getUserRSVPs] RSVP details:', allRSVPs.map(r => ({
      id: r._id,
      eventId: r.event?._id || r.event,
      eventTitle: r.event?.title || 'NO EVENT',
      eventDate: r.event?.date,
      eventTime: r.event?.time,
      hasEvent: !!r.event,
      numberOfGuests: r.numberOfGuests
    })));

    // Filter RSVPs based on event date in application logic
    const now = new Date();
    let filteredRSVPs = allRSVPs.filter((rsvp) => {
      if (!rsvp.event) {
        console.log('[getUserRSVPs] Filtering out RSVP with no event:', rsvp._id);
        return false; // Filter out if event was deleted
      }
      
      // Handle date - it might be a Date object or a string
      let eventDate = rsvp.event.date;
      if (eventDate instanceof Date) {
        // If it's a Date object, format it as YYYY-MM-DD
        const year = eventDate.getFullYear();
        const month = String(eventDate.getMonth() + 1).padStart(2, '0');
        const day = String(eventDate.getDate()).padStart(2, '0');
        eventDate = `${year}-${month}-${day}`;
      } else if (typeof eventDate === 'string') {
        // If it's a string, extract just the date part (YYYY-MM-DD)
        eventDate = eventDate.split('T')[0];
      }
      
      // Combine date and time for accurate comparison
      const eventDateTime = new Date(`${eventDate}T${rsvp.event.time || '00:00'}`);
      
      if (isNaN(eventDateTime.getTime())) {
        console.error('[getUserRSVPs] Invalid date created:', { 
          eventId: rsvp.event._id, 
          originalDate: rsvp.event.date, 
          formattedDate: eventDate, 
          time: rsvp.event.time 
        });
        return false; // Filter out invalid dates
      }
      
      // If no status filter, return all (frontend will filter)
      if (!status) {
        console.log('[getUserRSVPs] No status filter, including all:', { eventId: rsvp.event._id });
        return true;
      }
      
      if (status === "past") {
        const isPast = eventDateTime < now;
        console.log('[getUserRSVPs] Past check:', { eventId: rsvp.event._id, eventDateTime, now, isPast });
        return isPast;
      } else if (status === "upcoming") {
        // "upcoming" - include events happening today or in the future
        const isUpcoming = eventDateTime >= now;
        console.log('[getUserRSVPs] Upcoming check:', { eventId: rsvp.event._id, eventDateTime, now, isUpcoming });
        return isUpcoming;
      } else {
        // Unknown status, return all
        return true;
      }
    });

    console.log('[getUserRSVPs] Filtered RSVPs:', filteredRSVPs.length);

    // Apply pagination after filtering
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedRSVPs = filteredRSVPs.slice(skip, skip + parseInt(limit));

    // Get total count
    const total = filteredRSVPs.length;

    console.log('[getUserRSVPs] Response:', {
      count: paginatedRSVPs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      dataCount: paginatedRSVPs.length
    });

    res.status(200).json({
      success: true,
      count: paginatedRSVPs.length,
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      data: paginatedRSVPs,
    });
  } catch (error) {
    console.error('[getUserRSVPs] Error:', error);
    next(error);
  }
};

// Check RSVP Status
const checkRSVPStatus = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    // Get user's RSVP (any status)
    const rsvp = await RSVP.getUserRSVP(eventId, userId);
    
    if (rsvp) {
      await rsvp.populate("event", "title date location");
    }

    res.status(200).json({
      success: true,
      data: {
        hasRSVPed: !!rsvp && rsvp.status === "attending",
        rsvp: rsvp || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update RSVP (e.g., change number of guests or reactivate cancelled RSVP)
const updateRSVP = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { numberOfGuests, dietaryPreferences, status } = req.body;
    const userId = req.userId;

    // Find RSVP (any status)
    const rsvp = await RSVP.getUserRSVP(eventId, userId);

    if (!rsvp) {
      return next(new AppError("RSVP not found", 404, "RSVP_NOT_FOUND"));
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Handle status change (e.g., reactivating cancelled RSVP)
    if (status !== undefined && status !== rsvp.status) {
      if (status === "attending") {
        // Check capacity before reactivating
        const actualAttendeeCount = await RSVP.getActualAttendeeCount(eventId);
        const totalGuests = 1 + (parseInt(numberOfGuests) || rsvp.numberOfGuests || 0);
        
        if (actualAttendeeCount + totalGuests > event.capacity) {
          return next(
            new AppError(
              "Cannot reactivate RSVP, event is at full capacity",
              400,
              "CAPACITY_EXCEEDED"
            )
          );
        }
      }
      rsvp.status = status;
    }

    // Check capacity if updating guests (only if attending)
    if (numberOfGuests !== undefined && rsvp.status === "attending") {
      const newGuestCount = parseInt(numberOfGuests);
      const guestDiff = newGuestCount - (rsvp.numberOfGuests || 0);
      
      // Get actual count excluding this RSVP's current contribution
      const actualAttendeeCount = await RSVP.getActualAttendeeCount(eventId);
      const currentContribution = 1 + (rsvp.numberOfGuests || 0);
      const countWithoutThisRSVP = actualAttendeeCount - currentContribution;
      const newTotal = countWithoutThisRSVP + 1 + newGuestCount;

      if (newTotal > event.capacity) {
        return next(
          new AppError(
            "Cannot add guests, event would exceed capacity",
            400,
            "CAPACITY_EXCEEDED"
          )
        );
      }

      rsvp.numberOfGuests = newGuestCount;
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
