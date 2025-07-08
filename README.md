# AI Auth - Professional Authentication Backend

A comprehensive, secure, and scalable authentication backend built with Node.js, TypeScript, PostgreSQL, Nodemailer, and Twilio. This application provides a complete authentication solution with advanced features like 2FA, OTP verification, social login, and robust security measures.

## 🚀 Features

### Core Authentication
- **User Registration** with comprehensive validation
- **Email & Phone Login** with verification requirements
- **Social Login** (Google, GitHub) with OAuth 2.0 integration
- **JWT Authentication** with access & refresh tokens
- **Password Reset** via email or SMS
- **Change Password** with current password verification

### Verification System
- **Email Verification** via OTP (Nodemailer)
- **Phone Verification** via SMS OTP (Twilio)
- **Resend OTP** functionality with rate limiting

### Advanced Security
- **Two-Factor Authentication (2FA)**
  - Email-based 2FA
  - SMS-based 2FA  
  - Authenticator App support (TOTP)
  - QR code generation for app setup
- **Rate Limiting** on all endpoints
- **Account Lockout** after failed attempts
- **Password Strength Validation**
- **Change Password Security** (session invalidation)
- **Secure Token Management**

### Profile Management
- **Get User Profile**
- **Update Profile** information
- **Update Email** (with verification)
- **Update Phone** (with verification)

### Developer Experience
- **Professional Error Handling**
- **Comprehensive Logging** (Winston)
- **API Documentation** ready
- **Environment Configuration**
- **TypeScript** for type safety
- **Modular Architecture**

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT (Access & Refresh tokens)
- **Email Service**: Nodemailer (Gmail/SMTP)
- **SMS Service**: Twilio
- **2FA**: Speakeasy (TOTP) + QR Code generation
- **Validation**: Zod schemas
- **Logging**: Winston
- **Security**: bcryptjs, Rate limiting, CORS

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Gmail account (for email service)
- Twilio account (for SMS service)

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies

```bash
git clone <your-repo-url>
cd AI_Auth
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE ai_auth_db;
CREATE USER your_db_user WITH ENCRYPTED PASSWORD 'your_db_password';
GRANT ALL PRIVILEGES ON DATABASE ai_auth_db TO your_db_user;
```

### 3. Environment Configuration

Create a `.env` file in the root directory (use .env.example as template):

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=ai_auth_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex
JWT_EXPIRY=24h
REFRESH_TOKEN_SECRET=your_refresh_token_secret_here
REFRESH_TOKEN_EXPIRY=7d

# Email Configuration (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Other configurations...
```

### 4. Run the Application

```bash
# Development mode
npm run dev

# Production build and start
npm run build
npm start
```

The server will start on `http://localhost:3000`

## 📚 API Endpoints

### Register User Example

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fname": "John",
    "lname": "Doe",
    "email": "john.doe@example.com",
    "password": "SecurePass123!",
    "countryCode": "+1",
    "phone": "1234567890",
    "dob": "1990-01-01",
    "address": {
      "houseNumber": "123",
      "street": "Main St",
      "city": "New York",
      "state": "NY",
      "country": "USA",
      "pincode": "10001"
    }
  }'
```

## 🏗️ Project Structure

```
src/
├── config/
│   └── db.ts                 # Database configuration
├── middlewares/
│   ├── auth.ts              # Authentication middleware
│   ├── errorHandler.ts      # Global error handling
│   ├── rateLimiter.ts       # Rate limiting
│   └── validation.ts        # Request validation
├── models/
│   ├── User.ts              # User entity
│   └── OtpService.ts        # OTP entity
├── modules/
│   ├── controllers/
│   │   └── authController.ts # Auth controller (Register implemented)
│   └── routes/
│       └── authRoutes.ts    # Auth routes
├── services/
│   ├── emailService.ts      # Email service (Nodemailer)
│   ├── smsService.ts        # SMS service (Twilio)
│   └── otpService.ts        # OTP management
├── utils/
│   ├── ApiError.ts          # Custom error class
│   ├── ApiResponse.ts       # Standardized responses
│   ├── jwtUtils.ts          # JWT utilities
│   ├── logger.ts            # Winston logger
│   ├── otpGenerator.ts      # OTP generation
│   └── passwordUtils.ts     # Password utilities
├── validations/
│   └── authValidations.ts   # Zod validation schemas
├── app.ts                   # Express app setup
└── server.ts               # Server initialization
```

## ✅ Current Implementation Status

### ✅ Completed Components

1. **Infrastructure**
   - ✅ TypeScript configuration
   - ✅ Database setup (TypeORM + PostgreSQL)
   - ✅ Environment configuration
   - ✅ Logging system (Winston)
   - ✅ Error handling middleware
   - ✅ Rate limiting middleware

2. **Models**
   - ✅ User entity with all required fields
   - ✅ OtpService entity for OTP management

3. **Services**
   - ✅ Email service (Nodemailer) with HTML templates
   - ✅ SMS service (Twilio)
   - ✅ OTP service with TOTP support

4. **Utilities**
   - ✅ JWT utilities (access & refresh tokens)
   - ✅ Password utilities (hashing, validation)
   - ✅ OTP generator (secure)
   - ✅ API response & error classes

5. **Validation**
   - ✅ Comprehensive Zod schemas for all endpoints
   - ✅ Request validation middleware

6. **Authentication**
   - ✅ Register controller with full validation
   - ✅ Login controller with email/phone support
   - ✅ Social login controller (Google & GitHub OAuth)
   - ✅ Email/phone verification controllers
   - ✅ Password reset controllers
   - ✅ Profile management controllers
   - ✅2FA controllers with TOTP support
   - ✅ Update email/phone controllers
   - ✅ Authentication middleware
   - ✅ Authorization levels (email/phone verification)

### 🚧 Next Steps (Optional Enhancements)

All core authentication functionality is now complete! Optional enhancements:

1. **Token Management** - Logout/blacklist tokens
2. **Admin Panel** - User management interface
3. **Audit Logging** - User activity tracking
4. **Multi-tenancy** - Organization/workspace support
5. **API Rate Limits** - Per-user rate limiting
6. **Device Management** - Track user devices
7. **Social Provider Extensions** - Facebook, Twitter, etc.

## 🔐 Social Login Configuration

To enable social login features, you need to set up OAuth applications:

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to your `.env` file

### GitHub OAuth Setup
1. Go to GitHub Settings > Developer Settings > OAuth Apps
2. Create a new OAuth app
3. Set Authorization callback URL: `http://localhost:3000/api/auth/github/callback`
4. Copy Client ID and Client Secret to your `.env` file

### Social Login API Endpoints
- `GET /google/auth-url` - Get Google OAuth URL
- `GET /github/auth-url` - Get GitHub OAuth URL
- `POST /google/callback` - Handle Google OAuth callback
- `POST /github/callback` - Handle GitHub OAuth callback
- `POST /social-login` - Direct social login with provider token

## 🔐 Security Features Implemented

- ✅ Password strength validation
- ✅ Rate limiting on all endpoints
- ✅ JWT token security with proper expiration
- ✅ Secure OTP generation using crypto
- ✅ CORS configuration
- ✅ Input validation and sanitization
- ✅ Error handling without information disclosure
- ✅ Database query protection

## 📄 License

This project is licensed under the ISC License.