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

// Import routes
const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/event.routes");
const rsvpRoutes = require("./routes/rsvp.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

// Request ID middleware (must be early)
app.use(requestId);

// CORS configuration (must be before other middleware to handle preflight requests)
const allowedOrigins = [
  process.env.FRONTEND_LOCAL_URL,
  process.env.FRONTEND_PROD_URL,
  "http://localhost:3000", // Default React dev server
  "http://127.0.0.1:3000", // Alternative localhost
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

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles/scripts for emails
  crossOriginEmbedderPolicy: false,
}));

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

// Data sanitization - remove any keys that start with $ or contain .
// This prevents NoSQL injection attacks
app.use((req, res, next) => {
  try {
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object' || obj === null) {
        return;
      }
      
      // Handle arrays
      if (Array.isArray(obj)) {
        obj.forEach(item => sanitizeObject(item));
        return;
      }
      
      // Handle regular objects
      const keysToDelete = [];
      Object.keys(obj).forEach(key => {
        // Mark keys that start with $ (MongoDB operators) or contain . for deletion
        if (key.startsWith('$') || key.includes('.')) {
          keysToDelete.push(key);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      });
      
      // Delete marked keys
      keysToDelete.forEach(key => delete obj[key]);
    };

    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === 'object') {
      sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    next(error);
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

app.get("/", (req, res) => {
  res.status(200).send("Student Event Management API is running 🚀");
});
