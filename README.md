# Student Event Management System - Backend

A robust REST API backend for a student event management system built with Node.js, Express, and MongoDB. The system supports user authentication, event management, RSVP functionality, and admin controls.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication with refresh tokens
  - Role-based access control (Admin/User)
  - Secure password hashing with bcrypt
  - Email verification and password reset

- **Event Management**
  - Create, read, update, and delete events
  - Event approval workflow for admins
  - Rich event metadata (dates, locations, descriptions)
  - Event search and filtering

- **RSVP System**
  - Users can RSVP to events
  - Track attendance and responses
  - Manage RSVP status updates

- **Admin Panel**
  - User management and statistics
  - Event approval/rejection
  - System monitoring and analytics

- **Security Features**
  - Rate limiting and DDoS protection
  - Input validation and sanitization
  - CORS configuration
  - Helmet security headers
  - NoSQL injection prevention

- **API Features**
  - RESTful API design
  - Comprehensive error handling
  - Request logging and monitoring
  - Health check endpoints

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Express Validator
- **Email**: Nodemailer
- **Logging**: Morgan
- **Password Hashing**: bcryptjs

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn package manager

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jamanaka/student-event-management-system-backend.git
   cd student-event-management-system-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**

   Create a `.env` file in the root directory with the following variables:

   ```env
   # Database
   MONGODBCONNECTIONSTRING=mongodb://localhost:27017/student_event_management

   # JWT Secrets (generate secure random strings)
   JWT_SECRET=your_jwt_secret_here
   JWT_REFRESH_SECRET=your_refresh_secret_here

   # Email Configuration (optional but recommended)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password

   # Frontend URLs
   FRONTEND_LOCAL_URL=http://localhost:3001
   FRONTEND_PROD_URL=https://your-frontend-domain.com

   # Server Configuration
   PORT=5000
   NODE_ENV=development
   ```

4. **Start MongoDB**
   Make sure MongoDB is running locally or update the connection string for MongoDB Atlas.

5. **Run the application**
   ```bash
   # Development mode with auto-restart
   npm run dev

   # Production mode
   npm start
   ```

The server will start on port 5000 (or the port specified in your `.env` file).

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

#### POST /api/auth/login
Authenticate user and receive JWT tokens.

#### POST /api/auth/refresh
Refresh access token using refresh token.

#### POST /api/auth/logout
Logout user by invalidating refresh token.

#### POST /api/auth/forgot-password
Request password reset email.

#### POST /api/auth/reset-password
Reset password using reset token.

### Event Endpoints

#### GET /api/events
Get all approved events (public access).

#### GET /api/events/:id
Get specific event details.

#### POST /api/events
Create new event (authenticated users).

#### PUT /api/events/:id
Update existing event (event creator only).

#### DELETE /api/events/:id
Delete event (event creator or admin).

#### GET /api/events/my-events
Get events created by current user.

### RSVP Endpoints

#### GET /api/rsvp
Get user's RSVPs.

#### POST /api/rsvp
Create/update RSVP for an event.

#### DELETE /api/rsvp/:eventId
Remove RSVP for an event.

#### GET /api/rsvp/event/:eventId
Get all RSVPs for a specific event (admin only).

### Admin Endpoints

#### GET /api/admin/dashboard
Get admin dashboard statistics.

#### GET /api/admin/users
Get all users with pagination.

#### PUT /api/admin/users/:id
Update user status/role.

#### GET /api/admin/events/pending
Get pending events for approval.

#### PUT /api/admin/events/:id/status
Approve or reject events.

#### GET /api/admin/events
Get all events with filtering.

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

Tokens are automatically refreshed via the `x-new-token` header in responses.

## 📊 Data Models

### User
- `name`: String (required)
- `email`: String (required, unique)
- `password`: String (hashed, required)
- `role`: String (enum: 'user', 'admin', default: 'user')
- `isVerified`: Boolean (default: false)
- `profilePicture`: String (optional)

### Event
- `title`: String (required)
- `description`: String (required)
- `date`: Date (required)
- `location`: String (required)
- `capacity`: Number (optional)
- `category`: String (optional)
- `image`: String (optional)
- `status`: String (enum: 'pending', 'approved', 'rejected', default: 'pending')
- `creator`: ObjectId (ref: User)

### RSVP
- `user`: ObjectId (ref: User)
- `event`: ObjectId (ref: Event)
- `status`: String (enum: 'attending', 'maybe', 'not_attending')
- `createdAt`: Date

## 🧪 Testing

```bash
# Run tests (if implemented)
npm test
```

## 🚀 Deployment

### Environment Variables for Production
Ensure all required environment variables are set in your production environment.

### Build Process
The application is ready for deployment as-is. Consider using PM2 for process management in production.

```bash
npm install -g pm2
pm2 start server.js --name "student-event-api"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/jamanaka/student-event-management-system-backend/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🔄 API Versioning

Current API version: v1

All endpoints are prefixed with `/api/`. Future versions will use `/api/v2/`, etc.

---

**Note**: This API is part of the Student Event Management System. Make sure to also set up the [frontend application](https://github.com/jamanaka/student-event-management-system-frontend) for the complete experience.