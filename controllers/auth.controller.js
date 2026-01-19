const User = require("../models/User.model");
const OTP = require("../models/Otp.model");
const AppError = require("../utils/AppError");
const jwt = require("jsonwebtoken");
const {
  sendRegistrationOTP,
  sendPasswordResetOTP,
} = require("../utils/emailService");

// Generate JWT Token (Access Token - short lived)
const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
  });
};

// Generate Refresh Token
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });
};

// Register User
const register = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      studentId,
      department,
      graduationYear,
    } = req.body;

    // Ensure graduationYear is a number
    const gradYear = typeof graduationYear === 'string' 
      ? parseInt(graduationYear, 10) 
      : graduationYear;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(
        new AppError("User already exists with this email", 400, "USER_EXISTS")
      );
    }

    // Create user (inactive until OTP verification)
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      studentId,
      department,
      graduationYear: gradYear,
      role: "student",
      isActive: false,
    });

    await user.save();

    // Generate and send OTP
    const otpCode = await OTP.createOTP(email, "registration", user._id);

    await sendRegistrationOTP(email, otpCode, `${firstName} ${lastName}`);
    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email for OTP verification.",
      data: {
        userId: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === 11000) {
      return next(
        new AppError(
          "Email or Student ID already exists",
          400,
          "DUPLICATE_ENTRY"
        )
      );
    }
    next(error);
  }
};

// Verify OTP
const verifyOTP = async (req, res, next) => {
  try {
    const { email, otpCode } = req.body;

    // Validate OTP
    const result = await OTP.validateOTP(email, otpCode, "registration");

    if (!result.success) {
      return next(new AppError(result.message, 400, "OTP_VALIDATION_FAILED"));
    }

    // Activate user account
    const user = await User.findOneAndUpdate(
      { email },
      { isActive: true },
      { new: true }
    );

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Resend OTP for registration
const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if user exists and is not yet activated
    const user = await User.findOne({ email });
    if (!user) {
      return next(
        new AppError("User not found", 404, "USER_NOT_FOUND")
      );
    }

    if (user.isActive) {
      return next(
        new AppError("Account is already verified", 400, "ACCOUNT_ALREADY_ACTIVE")
      );
    }

    // Generate and send new OTP
    const otpCode = await OTP.createOTP(email, "registration", user._id);
    await sendRegistrationOTP(email, otpCode, `${user.firstName} ${user.lastName}`);

    res.status(200).json({
      success: true,
      message: "OTP resent successfully. Please check your email.",
    });
  } catch (error) {
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findByEmail(email);

    if (!user) {
      return next(
        new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
      );
    }

    // Check if account is active
    if (!user.isActive) {
      return next(
        new AppError(
          "Account not activated. Please verify your email.",
          403,
          "ACCOUNT_INACTIVE"
        )
      );
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(
        new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")
      );
    }

    // Generate tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        refreshToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Current User
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password -__v -createdAt -updatedAt"
    );

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Request Password Reset
const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(
        new AppError("No account found with this email", 404, "USER_NOT_FOUND")
      );
    }

    // Generate OTP for password reset
    const otpCode = await OTP.createOTP(email, "password_reset", user._id);

    await sendPasswordResetOTP(email, otpCode, user.firstName);

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
const resetPassword = async (req, res, next) => {
  try {
    const { email, otpCode, newPassword } = req.body;

    // Validate OTP
    const result = await OTP.validateOTP(email, otpCode, "password_reset");

    if (!result.success) {
      return next(new AppError(result.message, 400, "OTP_VALIDATION_FAILED"));
    }

    // Update password
    const user = await User.findById(result.userId);
    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};

// Update Profile
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, department, graduationYear } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (department) updateData.department = department;
    if (graduationYear) updateData.graduationYear = graduationYear;

    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password -__v");

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Refresh Token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(
        new AppError("Refresh token is required", 400, "REFRESH_TOKEN_REQUIRED")
      );
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return next(
        new AppError("User not found or inactive", 401, "USER_INVALID")
      );
    }

    // Generate new access token
    const newToken = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(
        new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN")
      );
    }
    if (error.name === "TokenExpiredError") {
      return next(
        new AppError("Refresh token expired", 401, "REFRESH_TOKEN_EXPIRED")
      );
    }
    next(error);
  }
};

// Change Password (when logged in)
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    // Get user with password
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return next(
        new AppError("Current password is incorrect", 401, "INVALID_PASSWORD")
      );
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
  updateProfile,
  changePassword,
  refreshToken,
  logout,
};
