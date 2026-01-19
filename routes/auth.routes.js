const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authValidations } = require("../middleware/validation.middleware");
const {
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimiter");

// Routes
router.post("/register", authLimiter, authValidations.register, register);
router.post("/verify-otp", otpLimiter, authValidations.verifyOTP, verifyOTP);
router.post("/resend-otp", otpLimiter, authValidations.resendOTP, resendOTP);
router.post("/login", authLimiter, authValidations.login, login);
router.get("/me", protect, getCurrentUser);
router.post(
  "/request-password-reset",
  passwordResetLimiter,
  authValidations.resendOTP, // Only email validation needed
  requestPasswordReset
);
router.post("/reset-password", passwordResetLimiter, authValidations.resetPassword, resetPassword);
router.put("/update-profile", protect, updateProfile);
router.put(
  "/change-password",
  protect,
  authValidations.changePassword,
  changePassword
);
router.post("/refresh-token", refreshToken);
router.post("/logout", protect, logout);

module.exports = router;
