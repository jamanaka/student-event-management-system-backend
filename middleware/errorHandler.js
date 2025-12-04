const AppError = require("../utils/AppError");

// Development error response - with stack traces
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: {
      message: err.message,
      code: err.errorCode,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    },
  });
};

// Production error response - user-friendly only
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message, // User-friendly message
        code: err.errorCode, // Technical code for debugging
        timestamp: new Date().toISOString(),
      },
    });
  }
  // Programming or unknown error: don't leak details
  else {
    console.error("ERROR 💥", err);
    res.status(500).json({
      success: false,
      error: {
        message: "Something went wrong! Please try again later.",
        code: "INTERNAL_SERVER_ERROR",
        timestamp: new Date().toISOString(),
      },
    });
  }
};

// MongoDB CastError handler (invalid ID)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, "INVALID_ID");
};

// MongoDB Duplicate field error
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400, "DUPLICATE_FIELD");
};

// MongoDB Validation error
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400, "VALIDATION_ERROR");
};

// JWT Error handlers
const handleJWTError = () =>
  new AppError("Invalid token. Please log in again.", 401, "INVALID_TOKEN");

const handleJWTExpiredError = () =>
  new AppError(
    "Your token has expired. Please log in again.",
    401,
    "TOKEN_EXPIRED"
  );

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.errorCode = err.errorCode || "INTERNAL_ERROR";
  err.status = err.status || "error";

  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    // MongoDB errors
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);

    // JWT errors
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
