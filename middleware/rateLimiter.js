const rateLimit = require("express-rate-limit");

// General API rate limiter
// More lenient limits for normal usage
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 500 : 1000, // Higher limits: 500 in prod, 1000 in dev
  message: {
    success: false,
    error: {
      message: "Too many requests from this IP, please try again later.",
      code: "TOO_MANY_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return true;
    }
    // Skip rate limiting for health check endpoint
    if (req.path === '/api/health') {
      return true;
    }
    // In development, be more lenient
    if (process.env.NODE_ENV === 'development') {
      return false; // Still apply, but with higher limit
    }
    return false;
  },
});

// Rate limiter for auth endpoints - more reasonable limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow 10 attempts per 15 minutes (increased from 5)
  message: {
    success: false,
    error: {
      message: "Too many authentication attempts, please try again in 15 minutes.",
      code: "TOO_MANY_AUTH_ATTEMPTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// OTP rate limiter - more reasonable for user experience
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Allow 5 OTP requests per hour (increased from 3)
  message: {
    success: false,
    error: {
      message: "Too many OTP requests. Please wait before requesting another code.",
      code: "TOO_MANY_OTP_REQUESTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      message: "Too many password reset attempts, please try again later.",
      code: "TOO_MANY_PASSWORD_RESET_ATTEMPTS",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
};

