const jwt = require("jsonwebtoken");
require("dotenv").config();
const AppError = require("../utils/AppError"); // ✅ ADDED

const verifyToken = (req, res, next) => {
  // Check both cookie AND Authorization header
  const token = req.cookies.token || req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    // ✅ CHANGED: Using AppError
    return next(new AppError("Unauthorized - No token provided", 401, "NO_TOKEN_PROVIDED"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT verification error:", error.message);
    // ✅ CHANGED: Using AppError
    return next(new AppError("Unauthorized - Invalid or expired token", 401, "INVALID_OR_EXPIRED_TOKEN"));
  }
};

module.exports = { verifyToken };