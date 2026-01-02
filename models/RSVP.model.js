const mongoose = require("mongoose");

const RSVPSchema = new mongoose.Schema(
  {
    // References
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event reference is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    // RSVP Status
    status: {
      type: String,
      enum: ["attending", "waitlisted", "cancelled"],
      default: "attending",
    },

    // Additional Information (Optional)
    numberOfGuests: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    dietaryPreferences: {
      type: String,
      trim: true,
      maxlength: [200, "Dietary preferences cannot exceed 200 characters"],
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate RSVPs
RSVPSchema.index({ event: 1, user: 1 }, { unique: true });

// Additional indexes for better query performance
RSVPSchema.index({ user: 1, createdAt: -1 }); // For user's RSVPs list
RSVPSchema.index({ event: 1, status: 1 }); // For event attendee queries
RSVPSchema.index({ status: 1 }); // For filtering by status
RSVPSchema.index({ createdAt: -1 }); // For sorting by creation date

// Combined pre-save middleware: update timestamp AND event attendees
// FIXED: Properly handle all status changes and guest count updates
RSVPSchema.pre("save", async function () {
  try {
    // Update timestamp
    this.updatedAt = Date.now();
    
    // Update event attendees count
    const Event = mongoose.model("Event");
    const totalPeople = 1 + (this.numberOfGuests || 0);

    if (this.isNew) {
      // New RSVP - only increment if status is attending
      if (this.status === "attending") {
        await Event.findByIdAndUpdate(this.event, {
          $inc: { currentAttendees: totalPeople },
        });
      }
    } else {
      // Existing RSVP - get original values
      const original = await this.constructor.findById(this._id);
      if (!original) {
        // Document was deleted, skip
        return;
      }

      const originalTotalPeople = 1 + (original.numberOfGuests || 0);
      const originalStatus = original.status;
      const newStatus = this.status;

      // Handle status changes
      if (this.isModified("status")) {
        // Status changed from attending to cancelled/waitlisted
        if (originalStatus === "attending" && newStatus !== "attending") {
          await Event.findByIdAndUpdate(this.event, {
            $inc: { currentAttendees: -originalTotalPeople },
          });
        }
        // Status changed from cancelled/waitlisted to attending
        else if (originalStatus !== "attending" && newStatus === "attending") {
          await Event.findByIdAndUpdate(this.event, {
            $inc: { currentAttendees: totalPeople },
          });
        }
        // Status changed between non-attending statuses (no change to count)
      }

      // Handle guest count changes (only if status is attending)
      if (this.isModified("numberOfGuests") && this.status === "attending") {
        const guestDiff = this.numberOfGuests - (original.numberOfGuests || 0);
        if (guestDiff !== 0) {
          await Event.findByIdAndUpdate(this.event, {
            $inc: { currentAttendees: guestDiff },
          });
        }
      }
    }
    // For async hooks in Mongoose, just return normally (no next callback needed)
  } catch (error) {
    // For async hooks, throw error (Mongoose will handle it)
    throw error;
  }
});

// Pre-remove middleware to update event's currentAttendees
// FIXED: Properly handle removal of attending RSVPs
RSVPSchema.pre("remove", async function (next) {
  try {
    const Event = mongoose.model("Event");

    // If RSVP was attending or waitlisted, decrement attendees
    // (waitlisted might have been counted if system allows it)
    if (this.status === "attending" || this.status === "waitlisted") {
      const totalPeople = 1 + (this.numberOfGuests || 0);
      await Event.findByIdAndUpdate(this.event, {
        $inc: { currentAttendees: -totalPeople },
      });
    }

    // For async hooks: if next exists, call it; otherwise just return
    if (next && typeof next === 'function') {
      next();
    }
  } catch (error) {
    // For async hooks: if next exists, call it with error; otherwise throw
    if (next && typeof next === 'function') {
      next(error);
    } else {
      throw error;
    }
  }
});

// Static method to check if user has RSVP'd to an event (any status)
RSVPSchema.statics.hasRSVPed = async function (eventId, userId) {
  const rsvp = await this.findOne({ event: eventId, user: userId });
  return !!rsvp && rsvp.status === "attending";
};

// Static method to get user's RSVP for an event (any status)
RSVPSchema.statics.getUserRSVP = async function (eventId, userId) {
  return await this.findOne({ event: eventId, user: userId });
};

// Static method to calculate actual attendee count from RSVPs
RSVPSchema.statics.getActualAttendeeCount = async function (eventId) {
  const eventObjectId = typeof eventId === 'string' ? new mongoose.Types.ObjectId(eventId) : eventId;
  const result = await this.aggregate([
    { $match: { event: eventObjectId, status: 'attending' } },
    { $group: { 
        _id: null, 
        total: { $sum: { $add: [1, { $ifNull: ['$numberOfGuests', 0] }] } } 
      } 
    }
  ]);
  return result.length > 0 ? result[0].total : 0;
};

// Static method to get event RSVP count
RSVPSchema.statics.getRSVPCount = async function (eventId) {
  const count = await this.countDocuments({
    event: eventId,
    status: "attending",
  });
  return count;
};

const RSVP = mongoose.model("RSVP", RSVPSchema);

module.exports = RSVP;
