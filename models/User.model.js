const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    // Authentication
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },

    // Role Management
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },

    // Account Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Student Information (optional fields)
    studentId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    department: {
      type: String,
      trim: true,
    },
    graduationYear: {
      type: Number,
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
    timestamps: true, // Mongoose will auto-manage createdAt and updatedAt
  }
);

// Hash password before saving
UserSchema.pre("save", async function () {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) {
    return;
  }

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Update updatedAt timestamp on save
UserSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Instance method to get user without sensitive data
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Static method to find user by email
UserSchema.statics.findByEmail = function (email) {
  return this.findOne({ email }).select("+password"); // Include password for auth
};

// Indexes for better query performance
UserSchema.index({ email: 1 }); // Explicit index for email lookups
UserSchema.index({ role: 1, isActive: 1 }); // For admin user queries
UserSchema.index({ createdAt: -1 }); // For sorting users by creation date

const User = mongoose.model("User", UserSchema);

module.exports = User;
