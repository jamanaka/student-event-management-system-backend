const express = require("express");
const OTP = require("../models/opt.js");
const User = require("../models/user.js");
const sendEmail = require("../utils/sendEmail.js");
const { verifyToken } = require("../middleware/verificationToken.js");
const generateOtpEmailTemplate = require("../utils/generateOtpEmailTemplate.js");
const router = express.Router();

// Send OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({
      email,
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes expiration
    });

    const emailBody = generateOtpEmailTemplate(otp, fullName || "");
    await sendEmail(email, "Your OTP Code", emailBody);

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
});

// Verify OTP and mark email as verified
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin)
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });

    const otpRecord = await OTP.findOne({ email, code: pin });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    // OTP is valid, now mark the user's email as verified
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update email verification status
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();

    // Also update verification status in buyer/seller/delivery profiles if they exist
    try {
      // Try to update Buyer profile
      const Buyer = require("../models/BuyerModel.js");
      const buyer = await Buyer.findOne({ user: user._id });
      if (buyer) {
        buyer.verification.emailVerified = true;
        await buyer.save();
      }

      // Try to update Seller profile
      const Seller = require("../models/SellerModel.js");
      const seller = await Seller.findOne({ user: user._id });
      if (seller) {
        seller.verification.emailVerified = true;
        await seller.save();
      }

      // Try to update Delivery profile
      const Delivery = require("../models/DeliveryModel.js");
      const delivery = await Delivery.findOne({ user: user._id });
      if (delivery) {
        delivery.verification.emailVerified = true;
        await delivery.save();
      }
    } catch (profileError) {
      console.log(
        "Profile update optional - continuing:",
        profileError.message
      );
    }

    // Delete the used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        emailVerified: true,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Email verification failed" });
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Delete previous OTPs
    await OTP.deleteMany({ email });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({
      email,
      code: otp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const emailBody = generateOtpEmailTemplate(otp, fullName || user.fullName);
    await sendEmail(email, "Your OTP Code", emailBody);

    res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to resend OTP" });
  }
});

// Check email verification status
router.get("/verify-status", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "emailVerified emailVerifiedAt"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to check verification status" });
  }
});

module.exports = router;
