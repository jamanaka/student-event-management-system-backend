class AppError extends Error {
  constructor(message, statusCode, errorCode = "INTERNAL_ERROR", details = null) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.errorCode = errorCode;
    this.isOperational = true; // Marks this as a trusted, expected error
    this.details = details; // Store additional error details (like validation errors)

    // Capture stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
