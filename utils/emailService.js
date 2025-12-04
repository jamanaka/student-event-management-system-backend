const nodemailer = require("nodemailer");
const AppError = require("./AppError");

// Email templates
const emailTemplates = {
  registrationOTP: (otpCode, userName) => ({
    subject: "Welcome to Student Event System - Verify Your Email",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background-color: #4CAF50; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🎓 Student Event System</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Hello ${
                      userName || "Student"
                    }!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Thank you for registering with the Student Event Management System. 
                        To complete your registration and verify your email address, 
                        please use the OTP code below:
                    </p>
                    <div style="text-align: center; margin: 40px 0;">
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block;">
                            <h1 style="color: #4CAF50; margin: 0; letter-spacing: 10px; font-size: 32px;">
                                ${otpCode}
                            </h1>
                        </div>
                    </div>
                    <p style="color: #999; font-size: 14px;">
                        This OTP will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        If you didn't request this verification, please ignore this email.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message, please do not reply to this email.
                    </p>
                </div>
            </div>
        `,
  }),

  passwordResetOTP: (otpCode, userName) => ({
    subject: "Password Reset Request - Student Event System",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background-color: #2196F3; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🔐 Password Reset</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Hello ${userName || "User"}!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        We received a request to reset your password for your Student Event System account.
                        Use the OTP code below to reset your password:
                    </p>
                    <div style="text-align: center; margin: 40px 0;">
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block;">
                            <h1 style="color: #2196F3; margin: 0; letter-spacing: 10px; font-size: 32px;">
                                ${otpCode}
                            </h1>
                        </div>
                    </div>
                    <p style="color: #999; font-size: 14px;">
                        This OTP will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #666; line-height: 1.6;">
                        If you didn't request a password reset, please ignore this email.
                        Your account will remain secure.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message, please do not reply to this email.
                    </p>
                </div>
            </div>
        `,
  }),

  eventApproved: (eventTitle, userName) => ({
    subject: "🎉 Your Event Has Been Approved!",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background-color: #4CAF50; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">✅ Event Approved</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Great news, ${
                      userName || "Organizer"
                    }!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Your event <strong>"${eventTitle}"</strong> has been approved by the admin 
                        and is now live on the Student Event System.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; display: inline-block;">
                            <p style="margin: 0; color: #4CAF50; font-weight: bold;">
                                🎉 Students can now RSVP to your event!
                            </p>
                        </div>
                    </div>
                    <p style="color: #666; line-height: 1.6;">
                        You can now share your event with other students and track RSVPs 
                        from your dashboard.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message from Student Event System.
                    </p>
                </div>
            </div>
        `,
  }),

  eventRejected: (eventTitle, userName, reason) => ({
    subject: "⚠️ Your Event Submission Needs Changes",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background-color: #FF9800; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">⚠️ Event Requires Changes</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Hello ${
                      userName || "Organizer"
                    },</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Your event submission <strong>"${eventTitle}"</strong> requires some changes 
                        before it can be approved.
                    </p>
                    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
                        <h4 style="color: #856404; margin-top: 0;">Admin Feedback:</h4>
                        <p style="color: #856404; margin-bottom: 0;">${reason}</p>
                    </div>
                    <p style="color: #666; line-height: 1.6;">
                        Please review the feedback above, make the necessary changes, and resubmit 
                        your event from your dashboard.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message from Student Event System.
                    </p>
                </div>
            </div>
        `,
  }),

  rsvpConfirmation: (eventTitle, eventDate, eventTime, userName) => ({
    subject: "✅ RSVP Confirmation",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <div style="text-align: center; background-color: #2196F3; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">✅ RSVP Confirmed</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">See you there, ${
                      userName || "Student"
                    }!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Your RSVP for <strong>"${eventTitle}"</strong> has been confirmed.
                    </p>
                    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Event Details:</h3>
                        <p style="margin: 10px 0;"><strong>📅 Date:</strong> ${eventDate}</p>
                        <p style="margin: 10px 0;"><strong>⏰ Time:</strong> ${eventTime}</p>
                        <p style="margin: 10px 0;"><strong>📍 Location:</strong> Check event page for details</p>
                    </div>
                    <p style="color: #666; line-height: 1.6;">
                        You'll receive a reminder 24 hours before the event. 
                        If you can no longer attend, please cancel your RSVP from the event page.
                    </p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        This is an automated message, please do not reply to this email.
                    </p>
                </div>
            </div>
        `,
  }),
};

// Create transporter
let transporter;

if (process.env.NODE_ENV === "production" && process.env.EMAIL_HOST) {
  // Production email configuration
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Verify transporter configuration (only in production)
  transporter
    .verify()
    .then(() => console.log("✅ Email service is ready"))
    .catch((err) =>
      console.log("❌ Email service configuration error:", err.message)
    );
} else {
  // Development: Create a mock transporter
  transporter = {
    sendMail: async function (mailOptions) {
      console.log("\n📧 EMAIL WOULD BE SENT (Development Mode):");
      console.log("To:", mailOptions.to);
      console.log("Subject:", mailOptions.subject);
      console.log("From:", mailOptions.from);
      console.log(
        "HTML Preview:",
        mailOptions.html ? "✓ HTML Content" : "No HTML"
      );
      console.log("---\n");

      // Return a mock response
      return {
        messageId: "dev-" + Date.now(),
        envelope: { from: mailOptions.from, to: [mailOptions.to] },
        accepted: [mailOptions.to],
        rejected: [],
        pending: [],
        response: "250 Mock email sent successfully",
      };
    },

    // Mock verify method for development
    verify: function (callback) {
      if (callback) {
        callback(null, true);
      }
      return Promise.resolve(true);
    },
  };

  console.log(
    "📧 Email service running in development mode (emails logged to console)"
  );
}

/**
 * Send email function
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text version
 * @param {string} options.html - HTML version
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from:
        process.env.EMAIL_FROM ||
        "Student Event System <noreply@studentevent.com>",
      to: options.to,
      subject: options.subject,
      text: options.text || "Please enable HTML to view this email.",
      html: options.html,
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV === "development") {
      console.log(`📧 Email sent to: ${options.to}`);
    } else {
      console.log(`📧 Email sent: ${info.messageId}`);
    }

    return info;
  } catch (error) {
    console.error("❌ Email sending failed:", error.message);

    // Don't throw error in production to avoid breaking the flow
    if (process.env.NODE_ENV === "production") {
      // Log to error monitoring service
      console.error("Email error details:", {
        to: options.to,
        subject: options.subject,
        error: error.message,
      });
    }

    // In development, rethrow the error
    if (process.env.NODE_ENV === "development") {
      throw new AppError(
        `Failed to send email: ${error.message}`,
        500,
        "EMAIL_SEND_FAILED"
      );
    }

    // In production, return a mock response to continue flow
    return { messageId: "error-simulated-" + Date.now() };
  }
};

// All your template functions remain the same:
const sendRegistrationOTP = async (to, otpCode, userName) => {
  const template = emailTemplates.registrationOTP(otpCode, userName);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

const sendPasswordResetOTP = async (to, otpCode, userName) => {
  const template = emailTemplates.passwordResetOTP(otpCode, userName);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

const sendEventApprovalEmail = async (to, eventTitle, userName) => {
  const template = emailTemplates.eventApproved(eventTitle, userName);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

const sendEventRejectionEmail = async (to, eventTitle, userName, reason) => {
  const template = emailTemplates.eventRejected(eventTitle, userName, reason);
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

const sendRSVPConfirmationEmail = async (
  to,
  eventTitle,
  eventDate,
  eventTime,
  userName
) => {
  const template = emailTemplates.rsvpConfirmation(
    eventTitle,
    eventDate,
    eventTime,
    userName
  );
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

module.exports = {
  sendEmail,
  sendRegistrationOTP,
  sendPasswordResetOTP,
  sendEventApprovalEmail,
  sendEventRejectionEmail,
  sendRSVPConfirmationEmail,
};
