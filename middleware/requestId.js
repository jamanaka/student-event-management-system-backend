const crypto = require("crypto");

/**
 * Request ID middleware
 * Adds a unique ID to each request for tracking
 */
const requestId = (req, res, next) => {
  // Generate or use existing request ID
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  
  // Add request ID to response headers
  res.setHeader("X-Request-ID", req.id);
  
  next();
};

module.exports = requestId;

