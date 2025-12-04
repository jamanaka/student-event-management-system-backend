class AppError extends Error {
  constructor(message, statusCode, errorCode = "INTERNAL_ERROR") {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.errorCode = errorCode;
    this.isOperational = true; // Marks this as a trusted, expected error

    // Capture stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
