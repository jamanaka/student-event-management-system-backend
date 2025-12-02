const express = require("express");
const router = express.Router();
const {
  register,
  verifyOTP,
  login,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
  updateProfile,
  refreshToken,
  logout,
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authValidations } = require("../middleware/validation.middleware");

// Routes
router.post("/register", authValidations.register, register);
router.post("/verify-otp", authValidations.verifyOTP, verifyOTP);
router.post("/login", authValidations.login, login);
router.get("/me", protect, getCurrentUser);
router.post(
  "/request-password-reset",
  authValidations.verifyOTP, // Only email validation needed
  requestPasswordReset
);
router.post("/reset-password", resetPassword);
router.put("/update-profile", protect, updateProfile);
router.post("/refresh-token", refreshToken);
router.post("/logout", protect, logout);

module.exports = router;
