const User = require("../models/User.model");
const Event = require("../models/Event.model");
const RSVP = require("../models/RSVP.model");
const AppError = require("../utils/AppError");

// Get all users (admin only)
const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role, isActive } = req.query;

    // Build query
    const query = {}; 
    if (search) { 
      query.$or = [ 
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get users
    const users = await User.find(query)
      .select("-password -__v")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: parseInt(page),
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password -__v");

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    // Get user stats
    const eventsCreated = await Event.countDocuments({ createdBy: id });
    const rsvpsCount = await RSVP.countDocuments({ user: id, status: "attending" });

    res.status(200).json({
      success: true,
      data: {
        ...user.toObject(),
        stats: {
          eventsCreated,
          rsvpsCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user status (activate/deactivate)
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return next(
        new AppError("isActive must be a boolean value", 400, "INVALID_INPUT")
      );
    }

    // Prevent deactivating yourself
    if (id === req.userId && !isActive) {
      return next(
        new AppError("You cannot deactivate your own account", 400, "CANNOT_DEACTIVATE_SELF")
      );
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Update user role (admin only)
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["student", "admin"].includes(role)) {
      return next(
        new AppError("Role must be either 'student' or 'admin'", 400, "INVALID_ROLE")
      );
    }

    // Prevent changing your own role
    if (id === req.userId) {
      return next(
        new AppError("You cannot change your own role", 400, "CANNOT_CHANGE_OWN_ROLE")
      );
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select("-password -__v");

    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (admin only)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.userId) {
      return next(
        new AppError("You cannot delete your own account", 400, "CANNOT_DELETE_SELF")
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
    }

    // Delete user's events and RSVPs
    await Event.deleteMany({ createdBy: id });
    await RSVP.deleteMany({ user: id });

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Get system statistics (admin only)
const getSystemStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalEvents,
      approvedEvents,
      pendingEvents,
      totalRSVPs,
      upcomingEvents,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Event.countDocuments(),
      Event.countDocuments({ status: "approved" }),
      Event.countDocuments({ status: "pending" }),
      RSVP.countDocuments({ status: "attending" }),
      Event.countDocuments({
        status: "approved",
        date: { $gte: new Date() },
      }),
    ]);

    // Get events by category
    const eventsByCategory = await Event.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentEvents = await Event.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          byRole: usersByRole,
        },
        events: {
          total: totalEvents,
          approved: approvedEvents,
          pending: pendingEvents,
          upcoming: upcomingEvents,
          byCategory: eventsByCategory,
        },
        rsvps: {
          total: totalRSVPs,
        },
        recentActivity: {
          eventsCreated: recentEvents,
          usersRegistered: recentUsers,
          period: "7 days",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getSystemStats,
};

