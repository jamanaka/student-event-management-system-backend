const AppError = require("../utils/AppError");
const { body, param, query, validationResult } = require("express-validator");

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    // Ensure next is a function
    if (typeof next !== 'function') {
      console.error('Validation middleware: next is not a function', typeof next);
      return res.status(500).json({
        success: false,
        message: 'Internal server error: middleware chain broken'
      });
    }

    try {
      // Run all validations
      await Promise.all(validations.map((validation) => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      // Format validation errors
      const formattedErrors = errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      }));

      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          formattedErrors
        )
      );
    } catch (error) {
      if (typeof next !== 'function') {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Internal server error: next is not a function',
            code: 'MIDDLEWARE_ERROR'
          }
        });
      }
      return next(error);
    }
  };
};

// Common validation rules
const authValidations = {
  register: validate([
    body("firstName")
      .trim()
      .notEmpty()
      .withMessage("First name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be 2-50 characters"),

    body("lastName")
      .trim()
      .notEmpty()
      .withMessage("Last name is required")
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be 2-50 characters"),

    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/\d/)
      .withMessage("Password must contain at least one number"),

    body("studentId")
      .trim()
      .notEmpty()
      .withMessage("Student ID is required")
      .matches(/^[A-Za-z0-9]+$/)
      .withMessage("Student ID can only contain letters and numbers"),

    body("department")
      .trim()
      .notEmpty()
      .withMessage("Department is required")
      .isLength({ max: 100 })
      .withMessage("Department name too long"),

    body("graduationYear")
      .notEmpty()
      .withMessage("Graduation year is required")
      .toInt()
      .isInt({ min: 2000, max: 2030 })
      .withMessage("Graduation year must be between 2000-2030"),
  ]),

  login: validate([
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),

    body("password").notEmpty().withMessage("Password is required"),
  ]),

  verifyOTP: validate([
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),

    body("otpCode")
      .trim()
      .notEmpty()
      .withMessage("OTP code is required")
      .isLength({ min: 4, max: 8 })
      .withMessage("OTP must be 4-8 characters")
      .matches(/^\d+$/)
      .withMessage("OTP must contain only numbers"),
  ]),

  resendOTP: validate([
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Please provide a valid email")
      .normalizeEmail(),
  ]),

  changePassword: validate([
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),

    body("newPassword")
      .notEmpty()
      .withMessage("New password is required")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
      .matches(/[A-Z]/)
      .withMessage("Password must contain at least one uppercase letter")
      .matches(/[a-z]/)
      .withMessage("Password must contain at least one lowercase letter")
      .matches(/\d/)
      .withMessage("Password must contain at least one number"),
  ]),
};

const eventValidations = {
  createEvent: validate([
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Event title is required")
      .isLength({ min: 3, max: 100 })
      .withMessage("Title must be 3-100 characters"),

    body("description")
      .trim()
      .notEmpty()
      .withMessage("Event description is required")
      .isLength({ min: 10, max: 2000 })
      .withMessage("Description must be 10-2000 characters"),

    body("date")
      .notEmpty()
      .withMessage("Event date is required")
      .isISO8601()
      .withMessage("Invalid date format")
      .custom((value) => {
        const date = new Date(value);
        const now = new Date();
        return date > now;
      })
      .withMessage("Event date must be in the future"),

    body("time")
      .trim()
      .notEmpty()
      .withMessage("Event time is required")
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Invalid time format (HH:MM)"),

    body("location")
      .trim()
      .notEmpty()
      .withMessage("Event location is required")
      .isLength({ min: 3, max: 200 })
      .withMessage("Location must be 3-200 characters"),

    body("category")
      .optional()
      .isIn([
        "academic",
        "social",
        "sports",
        "cultural",
        "career",
        "workshop",
        "other",
      ])
      .withMessage("Invalid category"),

    body("capacity")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Capacity must be between 1-1000"),

    body("contactEmail")
      .optional()
      .isEmail()
      .withMessage("Invalid contact email")
      .normalizeEmail(),

    body("contactPhone")
      .optional()
      .matches(/^[\d\s\-\+\(\)]{10,20}$/)
      .withMessage("Invalid phone number format"),
  ]),

  updateEventStatus: validate([
    body("status")
      .isIn(["approved", "rejected", "cancelled"])
      .withMessage("Invalid status"),

    body("rejectionReason")
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage("Rejection reason too long"),
  ]),

  eventIdParam: validate([
    param("id")
      .notEmpty()
      .withMessage("Event ID is required")
      .isMongoId()
      .withMessage("Invalid event ID format"),
  ]),

  eventIdParamForRSVP: validate([
    param("eventId")
      .notEmpty()
      .withMessage("Event ID is required")
      .isMongoId()
      .withMessage("Invalid event ID format"),
  ]),
};

const rsvpValidations = {
  createRSVP: validate([
    param("eventId")
      .notEmpty()
      .withMessage("Event ID is required")
      .isMongoId()
      .withMessage("Invalid event ID format"),

    body("numberOfGuests")
      .optional()
      .isInt({ min: 0, max: 5 })
      .withMessage("Guests must be 0-5"),

    body("dietaryPreferences")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Dietary preferences too long"),
  ]),
};

module.exports = {
  validate,
  authValidations,
  eventValidations,
  rsvpValidations,
};
