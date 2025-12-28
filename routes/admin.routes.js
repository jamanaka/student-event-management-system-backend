const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getSystemStats,
} = require("../controllers/admin.controller");
const { protect } = require("../middleware/auth.middleware");
const { restrictToAdmin } = require("../middleware/admin.middleware");
const { param, body, query, validationResult } = require("express-validator");
const { validate } = require("../middleware/validation.middleware");
const AppError = require("../utils/AppError");

// Custom validation middleware for admin routes
const validateAdmin = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      }));
      return next(
        new AppError("Validation failed", 400, "VALIDATION_ERROR", formattedErrors)
      );
    }
    next();
  };
};

// All admin routes require authentication and admin role
router.use(protect);
router.use(restrictToAdmin);

// User management routes
router.get(
  "/users",
  validateAdmin([
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("search").optional().isString().trim(),
    query("role").optional().isIn(["student", "admin"]),
    query("isActive").optional().isBoolean(),
  ]),
  getAllUsers
);

router.get(
  "/users/:id",
  validateAdmin([param("id").isMongoId().withMessage("Invalid user ID")]),
  getUserById
);

router.patch(
  "/users/:id/status",
  validateAdmin([
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("isActive").isBoolean().withMessage("isActive must be a boolean"),
  ]),
  updateUserStatus
);

router.patch(
  "/users/:id/role",
  validateAdmin([
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("role").isIn(["student", "admin"]).withMessage("Role must be student or admin"),
  ]),
  updateUserRole
);

router.delete(
  "/users/:id",
  validateAdmin([param("id").isMongoId().withMessage("Invalid user ID")]),
  deleteUser
);

// System statistics
router.get("/stats", getSystemStats);

module.exports = router;

