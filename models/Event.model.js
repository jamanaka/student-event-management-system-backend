const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    // Basic Information
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
      minlength: [3, "Event title must be at least 3 characters"],
      maxlength: [100, "Event title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
      trim: true,
      minlength: [10, "Event description must be at least 10 characters"],
      maxlength: [2000, "Event description cannot exceed 2000 characters"],
    },

    // Event Details
    date: {
      type: Date,
      required: [true, "Event date is required"],
      validate: {
        validator: function (value) {
          // Only validate if this is a new document (creation), not on updates
          if (this.isNew) {
            return value > new Date(); // Event must be in the future
          }
          return true; // Allow past dates for existing events
        },
        message: "Event date must be in the future",
      },
    },
    time: {
      type: String,
      required: [true, "Event time is required"],
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Please provide a valid time (HH:MM)",
      ],
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true; // Optional field
          return value >= this.date; // End date must be on or after start date
        },
        message: "Event end date must be on or after the start date",
      },
    },
    endTime: {
      type: String,
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Please provide a valid time (HH:MM)",
      ],
    },
    location: {
      type: String,
      required: [true, "Event location is required"],
      trim: true,
      minlength: [3, "Location must be at least 3 characters"],
    },

    // Categorization
    category: {
      type: String,
      required: [true, "Event category is required"],
      enum: [
        "academic",
        "social",
        "sports",
        "cultural",
        "career",
        "workshop",
        "other",
      ],
      default: "other",
    },

    // Status Management
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled", "completed"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },

    // Capacity Management
    capacity: {
      type: Number,
      required: [true, "Event capacity is required"],
      min: [1, "Capacity must be at least 1"],
      default: 50,
    },
    currentAttendees: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Media (Optional)
    imageUrl: {
      type: String,
      default: "",
    },

    // Event Type
    isOnline: {
      type: Boolean,
      default: false,
    },

    // Tags
    tags: {
      type: String, // Comma-separated tags
      default: "",
      maxlength: [500, "Tags cannot exceed 500 characters"],
    },

    // Organizer Information
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Contact Information
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    contactPhone: {
      type: String,
      trim: true,
    },

    // Metadata
    isFeatured: {
      type: Boolean,
      default: false,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for checking if event is full
EventSchema.virtual("isFull").get(function () {
  return this.currentAttendees >= this.capacity;
});

// Virtual for checking if event registration is open
EventSchema.virtual("registrationOpen").get(function () {
  const now = new Date();
  const eventDate = new Date(this.date);
  const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  return this.status === "approved" && now < oneDayBefore && !this.isFull;
});

// Update timestamp on save
EventSchema.pre("save", function (next) {
  try {
    this.updatedAt = Date.now();

    // If event is cancelled, clear capacity
    if (this.status === "cancelled") {
      this.currentAttendees = 0;
    }

    // Validate end date/time is at least 15 minutes after start date/time
    if (this.date && this.time && this.endDate && this.endTime) {
      const startDateStr = this.date instanceof Date 
        ? `${this.date.getFullYear()}-${String(this.date.getMonth() + 1).padStart(2, '0')}-${String(this.date.getDate()).padStart(2, '0')}`
        : this.date.split('T')[0];
      const startDateTime = new Date(`${startDateStr}T${this.time}`);
      
      const endDateStr = this.endDate instanceof Date
        ? `${this.endDate.getFullYear()}-${String(this.endDate.getMonth() + 1).padStart(2, '0')}-${String(this.endDate.getDate()).padStart(2, '0')}`
        : this.endDate.split('T')[0];
      const endDateTime = new Date(`${endDateStr}T${this.endTime}`);
      
      const minDurationMs = 15 * 60 * 1000; // 15 minutes in milliseconds
      const timeDifference = endDateTime - startDateTime;
      
      if (timeDifference < minDurationMs) {
        return next(new Error("Event end date and time must be at least 15 minutes after the start date and time"));
      }
    }

    if (next && typeof next === 'function') {
      next();
    }
  } catch (error) {
    if (next && typeof next === 'function') {
      next(error);
    } else {
      throw error;
    }
  }
});

// Indexes for better query performance
EventSchema.index({ status: 1, date: 1 }); // For fetching approved upcoming events
EventSchema.index({ createdBy: 1 }); // For fetching user's events
EventSchema.index({ category: 1 }); // For category filtering
EventSchema.index({ date: -1 }); // For sorting by date

const Event = mongoose.model("Event", EventSchema);

module.exports = Event;
