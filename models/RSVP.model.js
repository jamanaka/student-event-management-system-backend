const mongoose = require('mongoose');

const RSVPSchema = new mongoose.Schema({
  // References
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event reference is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  
  // RSVP Status
  status: {
    type: String,
    enum: ['attending', 'waitlisted', 'cancelled'],
    default: 'attending'
  },
  
  // Additional Information (Optional)
  numberOfGuests: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  dietaryPreferences: {
    type: String,
    trim: true,
    maxlength: [200, 'Dietary preferences cannot exceed 200 characters']
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate RSVPs
RSVPSchema.index({ event: 1, user: 1 }, { unique: true });

// Update timestamp on save
RSVPSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-save middleware to update event's currentAttendees
RSVPSchema.pre('save', async function(next) {
  try {
    const Event = mongoose.model('Event');
    
    if (this.isNew) {
      // New RSVP - increment event attendees
      await Event.findByIdAndUpdate(this.event, {
        $inc: { currentAttendees: 1 + this.numberOfGuests }
      });
    } else if (this.isModified('status') && this.status === 'cancelled') {
      // RSVP cancelled - decrement event attendees
      await Event.findByIdAndUpdate(this.event, {
        $inc: { currentAttendees: -(1 + this.numberOfGuests) }
      });
    } else if (this.isModified('numberOfGuests')) {
      // Guests count changed - calculate difference
      const original = await this.constructor.findById(this._id);
      const guestDiff = this.numberOfGuests - (original ? original.numberOfGuests : 0);
      
      if (guestDiff !== 0) {
        await Event.findByIdAndUpdate(this.event, {
          $inc: { currentAttendees: guestDiff }
        });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-remove middleware to update event's currentAttendees
RSVPSchema.pre('remove', async function(next) {
  try {
    const Event = mongoose.model('Event');
    
    // If RSVP was attending (not cancelled), decrement attendees
    if (this.status === 'attending') {
      await Event.findByIdAndUpdate(this.event, {
        $inc: { currentAttendees: -(1 + this.numberOfGuests) }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to check if user has RSVP'd to an event
RSVPSchema.statics.hasRSVPed = async function(eventId, userId) {
  const rsvp = await this.findOne({ event: eventId, user: userId });
  return !!rsvp && rsvp.status === 'attending';
};

// Static method to get event RSVP count
RSVPSchema.statics.getRSVPCount = async function(eventId) {
  const count = await this.countDocuments({ 
    event: eventId, 
    status: 'attending' 
  });
  return count;
};

const RSVP = mongoose.model('RSVP', RSVPSchema);

module.exports = RSVP;