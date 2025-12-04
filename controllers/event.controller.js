const Event = require("../models/Event.model");
const RSVP = require("../models/RSVP.model");
const AppError = require("../utils/AppError");
const {
  sendEventApprovalEmail,
  sendEventRejectionEmail,
} = require("../utils/emailService");

// Create Event
const createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      date,
      time,
      location,
      category,
      capacity,
      contactEmail,
      contactPhone,
      imageUrl,
    } = req.body;

    // Validate date is in the future
    const eventDate = new Date(date);
    if (eventDate <= new Date()) {
      return next(
        new AppError("Event date must be in the future", 400, "INVALID_DATE")
      );
    }

    // Create event
    const event = new Event({
      title,
      description,
      date: eventDate,
      time,
      location,
      category: category || "other",
      capacity: capacity || 50,
      contactEmail: contactEmail || req.userEmail,
      contactPhone,
      imageUrl,
      createdBy: req.userId,
      status: "pending",
    });

    await event.save();
    await event.populate("createdBy", "firstName lastName email department");

    res.status(201).json({
      success: true,
      message: "Event created successfully and pending admin approval",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Approved Events (Public)
const getAllEvents = async (req, res, next) => {
  try {
    const {
      category,
      status = "approved",
      page = 1,
      limit = 10,
      sort = "date",
      search,
    } = req.query;

    // Build query
    const query = { status: "approved" };

    // Apply filters
    if (category && category !== "all") {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Sort options
    const sortOptions = {};
    switch (sort) {
      case "dateDesc":
        sortOptions.date = -1;
        break;
      case "popular":
        sortOptions.currentAttendees = -1;
        break;
      case "newest":
        sortOptions.createdAt = -1;
        break;
      default:
        sortOptions.date = 1; // ascending by default
    }

    // Execute query
    const events = await Event.find(query)
      .populate("createdBy", "firstName lastName email department")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Event.countDocuments(query);

    // Check if user is logged in to add RSVP status
    if (req.userId) {
      for (let event of events) {
        const hasRSVPed = await RSVP.hasRSVPed(event._id, req.userId);
        event._doc.hasRSVPed = hasRSVPed;
      }
    }

    res.status(200).json({
      success: true,
      count: events.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: parseInt(page),
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// Get Pending Events (Admin Only)
const getPendingEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ status: "pending" })
      .populate("createdBy", "firstName lastName email studentId department")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// Get Event by ID
const getEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id)
      .populate("createdBy", "firstName lastName email department")
      .populate({
        path: "attendees",
        select: "firstName lastName email",
        options: { limit: 20 },
      });

    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Check permissions for non-approved events
    if (
      event.status !== "approved" &&
      req.userRole !== "admin" &&
      event.createdBy._id.toString() !== req.userId
    ) {
      return next(
        new AppError(
          "You do not have permission to view this event",
          403,
          "PERMISSION_DENIED"
        )
      );
    }

    // Check if user has RSVPed
    if (req.userId) {
      const hasRSVPed = await RSVP.hasRSVPed(event._id, req.userId);
      event._doc.hasRSVPed = hasRSVPed;
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// Update Event
const updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find event
    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Check if date is being updated to past
    if (updateData.date && new Date(updateData.date) <= new Date()) {
      return next(
        new AppError("Event date must be in the future", 400, "INVALID_DATE")
      );
    }

    // Update event
    Object.keys(updateData).forEach((key) => {
      if (key !== "status" || req.userRole === "admin") {
        event[key] = updateData[key];
      }
    });

    await event.save();
    await event.populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Event
const deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    // Delete all RSVPs for this event
    await RSVP.deleteMany({ event: id });

    // Delete event
    await event.deleteOne();

    res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Approve Event (Admin Only)
const approveEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    event.status = "approved";
    event.rejectionReason = undefined;

    await event.save();
    await event.populate("createdBy", "email firstName lastName");

    await sendEventApprovalEmail(
      event.createdBy.email,
      event.title,
      event.createdBy.firstName
    );

    res.status(200).json({
      success: true,
      message: "Event approved successfully",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// Reject Event (Admin Only)
const rejectEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim().length < 5) {
      return next(
        new AppError(
          "Please provide a valid rejection reason (min 5 characters)",
          400,
          "INVALID_REJECTION_REASON"
        )
      );
    }

    const event = await Event.findById(id);

    if (!event) {
      return next(new AppError("Event not found", 404, "EVENT_NOT_FOUND"));
    }

    event.status = "rejected";
    event.rejectionReason = rejectionReason.trim();

    await event.save();
    await event.populate("createdBy", "email firstName lastName");

    await sendEventRejectionEmail(
      event.createdBy.email,
      event.title,
      event.createdBy.firstName,
      rejectionReason
    );

    res.status(200).json({
      success: true,
      message: "Event rejected successfully",
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

// Get User's Events
const getUserEvents = async (req, res, next) => {
  try {
    const userId = req.userId;
    const { status } = req.query;

    const query = { createdBy: userId };
    if (status && status !== "all") {
      query.status = status;
    }

    const events = await Event.find(query)
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

// Get Event Statistics (Admin Only)
const getEventStats = async (req, res, next) => {
  try {
    const stats = await Event.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAttendees: { $sum: "$currentAttendees" },
        },
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: "$count" },
          statuses: { $push: { status: "$_id", count: "$count" } },
          totalAttendees: { $sum: "$totalAttendees" },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          totalAttendees: 1,
          statuses: 1,
        },
      },
    ]);

    // Get events by category
    const categoryStats = await Event.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get upcoming events count
    const upcomingEvents = await Event.countDocuments({
      status: "approved",
      date: { $gt: new Date() },
    });

    const result = {
      ...(stats[0] || { totalEvents: 0, totalAttendees: 0, statuses: [] }),
      categories: categoryStats,
      upcomingEvents,
    };

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
