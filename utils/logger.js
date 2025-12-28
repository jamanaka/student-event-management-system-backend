/**
 * Simple logging utility
 * In production, this could be replaced with Winston or similar
 */

const logger = {
  info: (message, ...args) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`, ...args);
  },

  error: (message, error, ...args) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`, error, ...args);
  },

  warn: (message, ...args) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (process.env.NODE_ENV === "development") {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [DEBUG] ${message}`, ...args);
    }
  },
};

module.exports = logger;

