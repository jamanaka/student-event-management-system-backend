require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("./connection/mongoDB");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const http = require("http");
const ErrorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const requestId = require("./middleware/requestId");
const AppError = require("./utils/AppError");

// Import routes
const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/event.routes");
const rsvpRoutes = require("./routes/rsvp.routes");
const adminRoutes = require("./routes/admin.routes");

// Validate required environment variables
const requiredEnvVars = [
  'MONGODBCONNECTIONSTRING',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Validate optional but recommended environment variables
const recommendedEnvVars = [
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'FRONTEND_LOCAL_URL',
  'FRONTEND_PROD_URL'
];

const missingRecommendedVars = recommendedEnvVars.filter(envVar => !process.env[envVar]);

if (missingRecommendedVars.length > 0) {
  console.warn('⚠️  Missing recommended environment variables:', missingRecommendedVars.join(', '));
  console.warn('Some features may not work properly without these variables.');
}

console.log('✅ Environment variables validated successfully');

const app = express();

// Request ID middleware (must be early)
app.use(requestId);

// Security headers (apply before CORS)
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles/scripts for emails
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration (must be before other middleware to handle preflight requests)
const allowedOrigins = [
  process.env.FRONTEND_LOCAL_URL,
  process.env.FRONTEND_PROD_URL,
  "http://localhost:3001", // Default React dev server
  "http://127.0.0.1:3001", // Alternative localhost
].filter(Boolean); // Remove undefined values

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or curl)
      if (!origin) {
        return callback(null, true);
      }

      // In development, allow localhost origins
      if (process.env.NODE_ENV === "development") {
        if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
          return callback(null, true);
        }
      }

      // Check against allowed origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked request from:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Refresh-Token",
      "Accept",
      "Origin",
    ],
    exposedHeaders: ["x-new-token"],
    optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

// Body parsing
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Rate limiting
app.use("/api/", apiLimiter);

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Data sanitization - prevent NoSQL injection attacks
app.use((req, res, next) => {
  try {
    const sanitizeObject = (obj, depth = 0) => {
      // Prevent deep recursion attacks
      if (depth > 10) {
        throw new Error('Object too deeply nested');
      }

      if (!obj || typeof obj !== 'object' || obj === null) {
        return obj;
      }

      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, depth + 1));
      }

      // Handle regular objects
      const sanitized = {};
      const dangerousKeys = [];

      Object.keys(obj).forEach(key => {
        // Block MongoDB operators (keys starting with $)
        if (key.startsWith('$')) {
          dangerousKeys.push(key);
          return;
        }

        // Allow dots in field names but validate they're reasonable
        // Block extremely long keys or keys with multiple dots that might be injection attempts
        if (key.length > 100 || (key.match(/\./g) || []).length > 3) {
          dangerousKeys.push(key);
          return;
        }

        // Recursively sanitize nested objects
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitized[key] = sanitizeObject(obj[key], depth + 1);
        } else {
          sanitized[key] = obj[key];
        }
      });

      // Log dangerous keys for monitoring (only in development)
      if (dangerousKeys.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn('Blocked potentially dangerous keys:', dangerousKeys);
      }

      return sanitized;
    };

    // Sanitize request data
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    // Note: req.params are typically route parameters and should be validated by route handlers

    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    return next(new AppError('Invalid request data', 400, 'INVALID_REQUEST_DATA'));
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).send("Student Event Management API is running 🚀");
});

// 2) ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/rsvp", rsvpRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.originalUrl} not found`,
      code: "ROUTE_NOT_FOUND",
    },
  });
});

// Error handler (must be last)
app.use(ErrorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed Origins:", allowedOrigins);
});