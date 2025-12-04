require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./connection/mongoDB");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const http = require("http");
const sanitize = require("sanitize");
const ErrorHandler = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth.routes");
const eventRoutes = require("./routes/event.routes");
const rsvpRoutes = require("./routes/rsvp.routes");

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

const allowedOrigins = [
  process.env.FRONTEND_LOCAL_URL,
  process.env.FRONTEND_PROD_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked request from:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  })
);

app.use((req, res, next) => {
  if (req.body) sanitize.sanitize(req.body);
  if (req.query) sanitize.sanitize(req.query);
  if (req.params) sanitize.sanitize(req.params);
  next();
});

// 2) ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);

// Version 2: Separate RSVP routes
app.use("/api/rsvp", rsvpRoutes);

// Error handler
app.use(ErrorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed Origins:", allowedOrigins);
});
