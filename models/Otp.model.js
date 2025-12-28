// models/OtpModel.js
const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
  {
    // User Identification
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    // OTP Code
    code: {
      type: String,
      required: [true, "OTP code is required"],
      minlength: [4, "OTP code must be at least 4 characters"],
      maxlength: [8, "OTP code cannot exceed 8 characters"],
    },

    // OTP Type (for different use cases)
    purpose: {
      type: String,
      enum: ["registration", "login", "password_reset", "email_verification"],
      default: "registration",
    },

    // Expiration Management
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
      index: { expireAfterSeconds: 0 }, // Auto-delete when expiresAt passes
    },

    // Attempts Tracking (prevent brute force)
    attempts: {
      type: Number,
      default: 0,
      max: [5, "Maximum attempts exceeded"],
    },

    // Verification Status
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Associated User (if applicable)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
OtpSchema.index({ email: 1, purpose: 1 });

// Note: expiresAt is set directly in createOTP method, so no pre-save hook needed

// Static method to generate OTP
OtpSchema.statics.generateOTP = function (length = 6) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

// Static method to create OTP record
OtpSchema.statics.createOTP = async function (
  email,
  purpose = "registration",
  userId = null
) {
  try {
    // Delete any existing OTPs for this email and purpose
    await this.deleteMany({ email, purpose });

    // Generate new OTP
    const otpCode = this.generateOTP(6);

    // Set expiration to 10 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Create and save OTP record
    const otp = new this({
      email,
      code: otpCode,
      purpose,
      userId,
      expiresAt,
    });

    await otp.save();
    return otpCode;
  } catch (error) {
    throw new Error(`Failed to create OTP: ${error.message}`);
  }
};

// Instance method to verify OTP
OtpSchema.methods.verifyOTP = function (inputCode, incrementAttempts = true) {
  // Check if expired
  if (new Date() > this.expiresAt) {
    return { success: false, message: "OTP has expired" };
  }

  // Check if maximum attempts reached
  if (this.attempts >= 5) {
    return {
      success: false,
      message: "Maximum verification attempts exceeded",
    };
  }

  // Increment attempts if specified
  if (incrementAttempts) {
    this.attempts += 1;
  }

  // Verify code
  if (this.code !== inputCode) {
    return { success: false, message: "Invalid OTP code" };
  }

  // Mark as verified
  this.isVerified = true;
  return { success: true, message: "OTP verified successfully" };
};

// Static method to validate OTP
OtpSchema.statics.validateOTP = async function (
  email,
  code,
  purpose = "registration"
) {
  try {
    const otp = await this.findOne({
      email,
      purpose,
      isVerified: false,
    });

    if (!otp) {
      return { success: false, message: "OTP not found or already verified" };
    }

    const verificationResult = otp.verifyOTP(code);

    if (verificationResult.success) {
      await otp.save();
      return {
        success: true,
        message: verificationResult.message,
        userId: otp.userId,
      };
    } else {
      await otp.save();
      return verificationResult;
    }
  } catch (error) {
    throw new Error(`OTP validation failed: ${error.message}`);
  }
};

// Static method to cleanup expired OTPs
OtpSchema.statics.cleanupExpired = async function () {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
  return result.deletedCount;
};

const OTP = mongoose.model("OTP", OtpSchema);

module.exports = OTP;
