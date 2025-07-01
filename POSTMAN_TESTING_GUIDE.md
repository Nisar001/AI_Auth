# AI Auth API Testing Guide - Postman Instructions (Updated)

## 🚨 Recent Fixes Applied

### Fixed Issues:
1. **OTP Verification Problems** - Fixed email/phone OTP validation logic
2. **SMS Delivery Issues** - Added mock SMS mode with console logging
3. **Phone Number Format** - Improved phone number parsing and storage
4. **TypeScript Errors** - Fixed null assignment issues
5. **Added Missing Controllers** - UpdateEmailController and UpdatePhoneController

## Prerequisites

1. **Start the Server**
   ```bash
   npm run dev
   ```
   Server should be running on `http://localhost:3000` (or your configured port)

2. **Database Setup**
   - Ensure PostgreSQL is running
   - Database connection is configured in `.env`
   - Tables should be auto-created by TypeORM

## Postman Collection Setup

### Base URL
Set up an environment variable in Postman:
- Variable: `base_url`
- Value: `http://localhost:3000/api/auth`

### Environment Variables
Create these variables in your Postman environment:
- `base_url`: `http://localhost:3000/api/auth`
- `access_token`: (will be set automatically from responses)
- `refresh_token`: (will be set automatically from responses)
- `user_email`: (set your test email)
- `user_phone`: (set your test phone with country code)

## API Testing Order & Instructions

### 1. User Registration
**POST** `{{base_url}}/register`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "fname": "John",
  "mname": "Michael",
  "lname": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "countryCode": "+1",
  "phone": "234567890",
  "dob": "1990-01-15",
  "address": {
    "houseNumber": "123",
    "street": "Main Street",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "pincode": "10001"
  }
}
```

**📱 Important Phone Format Notes:**
- Use `countryCode`: "+1" and `phone`: "234567890" (without country code)
- System will store them separately for better validation
- SMS will be sent to the combined number: +1234567890

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Registration successful! Please check your email and phone for verification codes.",
  "data": {
    "user": {
      "id": "uuid",
      "fname": "John",
      "email": "john.doe@example.com",
      "isEmailVerified": false,
      "isPhoneVerified": false
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "jwt_refresh_token"
    },
    "nextSteps": [...]
  }
}
```

**Postman Tests Script:**
```javascript
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("access_token", response.data.tokens.accessToken);
    pm.environment.set("refresh_token", response.data.tokens.refreshToken);
    pm.environment.set("user_id", response.data.user.id);
}
```

### 2. Email Verification
**POST** `{{base_url}}/verify-email`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "email": "john.doe@example.com",
  "otp": "123456"
}
```

**Note:** Get the OTP from your email or check server logs for the generated OTP.

### 3. Phone Verification
**POST** `{{base_url}}/verify-phone`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**📱 SMS OTP Notes:**
- If Twilio is not configured, check your console for mock SMS:
```
📱 MOCK SMS MESSAGE:
To: +1234567890
Message: Your AI Auth OTP for phone verification is: 123456...
-------------------
```
- Use the OTP from console or real SMS

### 4. User Login
**POST** `{{base_url}}/login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "identifier": "john.doe@example.com",
  "password": "SecurePass123!"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "fname": "John",
      "isEmailVerified": true,
      "isPhoneVerified": true
    },
    "tokens": {
      "accessToken": "new_jwt_token",
      "refreshToken": "new_refresh_token"
    }
  }
}
```

**Postman Tests Script:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("access_token", response.data.tokens.accessToken);
    pm.environment.set("refresh_token", response.data.tokens.refreshToken);
}
```

### 5. Get User Profile
**GET** `{{base_url}}/profile`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

### 6. Update User Profile
**PUT** `{{base_url}}/profile`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "fname": "Jonathan",
  "lname": "Smith",
  "address": {
    "city": "Los Angeles",
    "state": "CA"
  }
}
```

### 7. Resend OTP
**POST** `{{base_url}}/resend-otp`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "identifier": "john.doe@example.com",
  "type": "email"
}
```

### 8. Forgot Password
**POST** `{{base_url}}/forgot-password`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "identifier": "john.doe@example.com",
  "method": "email"
}
```

### 9. Reset Password
**POST** `{{base_url}}/reset-password`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "identifier": "john.doe@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePass123!"
}
```

### 10. Update Email (NEW)
**POST** `{{base_url}}/update-email`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "newEmail": "john.newemail@example.com",
  "currentPassword": "SecurePass123!"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Email update initiated. Please check your new email for verification code.",
  "data": {
    "message": "Verification code sent to new email address",
    "newEmail": "john.newemail@example.com",
    "expiresInMinutes": 10
  }
}
```

### 11. Confirm Email Update (NEW)
**POST** `{{base_url}}/confirm-email-update`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "newEmail": "john.newemail@example.com",
  "otp": "123456"
}
```

**📧 Note:** Check the new email address for the OTP verification code.

### 12. Update Phone (NEW)
**POST** `{{base_url}}/update-phone`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "newPhone": "+1987654321",
  "countryCode": "+1",
  "currentPassword": "SecurePass123!"
}
```

### 13. Confirm Phone Update (NEW)
**POST** `{{base_url}}/confirm-phone-update`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "newPhone": "+1987654321",
  "otp": "123456"
}
```

**📱 Note:** Check console for mock SMS or your phone for the OTP.

### 14. Setup 2FA
**POST** `{{base_url}}/setup-2fa`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "method": "email",
  "password": "SecurePass123!"
}
```

For authenticator app:
```json
{
  "method": "auth_app",
  "password": "SecurePass123!"
}
```

### 15. Verify 2FA Setup
**POST** `{{base_url}}/verify-2fa-setup`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "code": "123456",
  "method": "email"
}
```

### 16. Get 2FA QR Code
**GET** `{{base_url}}/2fa-qr-code`

**Headers:**
```
Authorization: Bearer {{access_token}}
```

### 17. Disable 2FA
**POST** `{{base_url}}/disable-2fa`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body (JSON):**
```json
{
  "password": "SecurePass123!"
}
```

### 18. Refresh Token
**POST** `{{base_url}}/refresh-token`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "refreshToken": "{{refresh_token}}"
}
```

### 19. Logout
**POST** `{{base_url}}/logout`

**Headers:**
```
Authorization: Bearer {{access_token}}
```

### 20. Logout All Devices
**POST** `{{base_url}}/logout-all`

**Headers:**
```
Authorization: Bearer {{access_token}}
```

## Social Login APIs (Google & GitHub OAuth)

### 21. Get Google Auth URL
**GET** `{{base_url}}/google/auth-url`

**Description:** Gets the Google OAuth authorization URL for user redirection.

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Google OAuth URL generated successfully",
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=profile%20email&state=random_state_string"
  }
}
```

**Usage:**
1. Copy the `authUrl` from the response
2. Open it in your browser
3. Complete Google OAuth flow
4. Google redirects to your redirect URI with `code` and `state` parameters

### 22. Get GitHub Auth URL
**GET** `{{base_url}}/github/auth-url`

**Description:** Gets the GitHub OAuth authorization URL for user redirection.

**Expected Response (200):**
```json
{
  "success": true,
  "message": "GitHub OAuth URL generated successfully",
  "data": {
    "authUrl": "https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=user:email&state=random_state_string"
  }
}
```

**Usage:**
1. Copy the `authUrl` from the response
2. Open it in your browser
3. Complete GitHub OAuth flow
4. GitHub redirects to your redirect URI with `code` and `state` parameters

### 23. Google OAuth Callback
**POST** `{{base_url}}/google/callback`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "code": "authorization_code_from_google",
  "state": "state_parameter_from_auth_url"
}
```

**Description:** Handles the Google OAuth callback and creates/logs in the user.

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Google login successful",
  "data": {
    "user": {
      "id": "uuid",
      "fname": "John",
      "lname": "Doe",
      "email": "john.doe@gmail.com",
      "isEmailVerified": true,
      "socialProviders": ["google"],
      "googleId": "google_user_id_123456"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "jwt_refresh_token"
    },
    "isNewUser": false
  }
}
```

**Postman Tests Script:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data.tokens) {
        pm.environment.set('access_token', response.data.tokens.accessToken);
        pm.environment.set('refresh_token', response.data.tokens.refreshToken);
        pm.environment.set('user_id', response.data.user.id);
        console.log('Google login successful, tokens saved');
    }
}
```

### 24. GitHub OAuth Callback
**POST** `{{base_url}}/github/callback`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "code": "authorization_code_from_github",
  "state": "state_parameter_from_auth_url"
}
```

**Description:** Handles the GitHub OAuth callback and creates/logs in the user.

**Expected Response (200):**
```json
{
  "success": true,
  "message": "GitHub login successful",
  "data": {
    "user": {
      "id": "uuid",
      "fname": "John",
      "lname": "Doe",
      "email": "john.doe@users.noreply.github.com",
      "isEmailVerified": true,
      "socialProviders": ["github"],
      "githubId": "12345678"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "jwt_refresh_token"
    },
    "isNewUser": true
  }
}
```

**Postman Tests Script:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.data.tokens) {
        pm.environment.set('access_token', response.data.tokens.accessToken);
        pm.environment.set('refresh_token', response.data.tokens.refreshToken);
        pm.environment.set('user_id', response.data.user.id);
        console.log('GitHub login successful, tokens saved');
    }
}
```

### 25. Direct Social Login
**POST** `{{base_url}}/social-login`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "provider": "google",
  "accessToken": "social_provider_access_token",
  "email": "user@example.com",
  "name": "John Doe",
  "socialId": "google_user_id_123456",
  "avatar": "https://lh3.googleusercontent.com/a/avatar.jpg"
}
```

**Description:** Direct social login using provider access token (alternative to OAuth flow).

**Provider Options:** `google` or `github`

**Expected Response (200):**
```json
{
  "success": true,
  "message": "Social login successful",
  "data": {
    "user": {
      "id": "uuid",
      "fname": "John",
      "lname": "Doe",
      "email": "user@example.com",
      "isEmailVerified": true,
      "socialProviders": ["google"],
      "googleId": "google_user_id_123456"
    },
    "tokens": {
      "accessToken": "jwt_token",
      "refreshToken": "jwt_refresh_token"
    },
    "isNewUser": false
  }
}
```

**Postman Tests Script:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set('access_token', response.data.tokens.accessToken);
    pm.environment.set('refresh_token', response.data.tokens.refreshToken);
    pm.environment.set('user_id', response.data.user.id);
    console.log('Social login successful, tokens saved');
}
```

## 🔐 Social Login Testing Guide

### Prerequisites for Social Login Testing

1. **Environment Variables Setup (.env):**
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

   # GitHub OAuth
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback

   # CORS Origins
   CORS_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

2. **OAuth App Setup:**

   **Google OAuth App:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`

   **GitHub OAuth App:**
   - Go to GitHub Settings > Developer Settings > OAuth Apps
   - Create a new OAuth app
   - Set Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

### Testing Workflow

#### Method 1: OAuth Flow Testing (Recommended)

1. **Get Auth URL:**
   - Use "Get Google Auth URL" or "Get GitHub Auth URL" endpoint
   - Copy the returned `authUrl`

2. **Browser OAuth Flow:**
   - Open the `authUrl` in browser
   - Complete the OAuth consent flow
   - Note the `code` and `state` parameters from redirect URL

3. **Complete Login:**
   - Use "Google OAuth Callback" or "GitHub OAuth Callback" endpoint
   - Provide the `code` and `state` from step 2

#### Method 2: Direct Token Login (For Mobile/SPA)

1. **Get Provider Access Token:**
   - Implement Google/GitHub OAuth in your frontend
   - Obtain access token from provider

2. **Direct Login:**
   - Use "Direct Social Login" endpoint
   - Provide provider access token and user details

### Testing Tips

1. **State Validation:** Always use the exact `state` parameter returned from auth URL
2. **Code Expiry:** OAuth codes expire quickly (usually 10 minutes)
3. **Email Conflicts:** If email already exists, user will be linked to existing account
4. **Provider IDs:** Social IDs are stored to prevent duplicate accounts
5. **Token Management:** Social login generates same JWT tokens as regular login

### Error Scenarios for Social Login

1. **Invalid Authorization Code:**
   ```json
   {
     "code": "invalid_code",
     "state": "valid_state"
   }
   ```
   **Expected:** 400 Bad Request

2. **Missing State Parameter:**
   ```json
   {
     "code": "valid_code"
   }
   ```
   **Expected:** 400 Bad Request

3. **Invalid Provider in Direct Login:**
   ```json
   {
     "provider": "facebook",
     "accessToken": "token"
   }
   ```
   **Expected:** 400 Bad Request

4. **Missing OAuth Configuration:**
   - Remove `GOOGLE_CLIENT_ID` from .env
   - Try Google auth URL endpoint
   **Expected:** 500 Internal Server Error

## Error Testing Scenarios

## 🔧 TROUBLESHOOTING COMMON ISSUES

### Issue 1: "Invalid or expired OTP" for Email Verification
**Cause:** OTP verification logic was fixed - ensure you're using the latest OTP
**Solution:**
1. Check your email for the most recent OTP
2. Verify the email address matches exactly
3. OTP expires in 10 minutes
4. Check server logs for generated OTP if email service fails

### Issue 2: SMS OTP Not Received
**Cause:** Twilio not configured or phone format issues
**Solution:**
1. **Check Console:** Look for mock SMS messages:
   ```
   📱 MOCK SMS MESSAGE:
   To: +1234567890
   Message: Your AI Auth OTP for phone verification is: 123456...
   ```
2. **Phone Format:** Use format like `+1234567890` (with country code)
3. **Configure Twilio:** Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### Issue 3: Phone Verification Fails
**Cause:** Phone number storage format changed
**Solution:**
1. During registration, use: `"countryCode": "+1", "phone": "234567890"`
2. During verification, use: `"phone": "+1234567890"` (combined format)
3. System now stores country code and phone separately for better validation

### Issue 4: TypeScript Compilation Errors
**Cause:** Strict null checks
**Solution:** All fixed - use `undefined` instead of `null` for optional fields

### Issue 5: Update Email/Phone Controllers Missing
**Cause:** Controllers were not implemented
**Solution:** Now implemented with full OTP verification workflow

## Error Testing Scenarios

### 1. Invalid Email Format
**POST** `{{base_url}}/register`
```json
{
  "email": "invalid-email",
  "password": "SecurePass123!"
}
```
**Expected:** 400 Bad Request with validation errors

### 2. Weak Password
**POST** `{{base_url}}/register`
```json
{
  "email": "test@example.com",
  "password": "123"
}
```
**Expected:** 400 Bad Request with password requirements

### 3. Missing Required Fields
**POST** `{{base_url}}/register`
```json
{
  "email": "test@example.com"
}
```
**Expected:** 400 Bad Request with missing fields error

### 4. Invalid Login Credentials
**POST** `{{base_url}}/login`
```json
{
  "identifier": "wrong@example.com",
  "password": "wrongpassword"
}
```
**Expected:** 401 Unauthorized

### 5. Invalid OTP
**POST** `{{base_url}}/verify-email`
```json
{
  "email": "john.doe@example.com",
  "otp": "000000"
}
```
**Expected:** 400 Bad Request

### 6. Unauthorized Access (No Token)
**GET** `{{base_url}}/profile`
**Headers:** None
**Expected:** 401 Unauthorized

### 7. Expired/Invalid Token
**GET** `{{base_url}}/profile`
**Headers:**
```
Authorization: Bearer invalid_token
```
**Expected:** 401 Unauthorized

## Rate Limiting Tests

### 1. Registration Rate Limit
Make 6+ rapid requests to `/register` endpoint
**Expected:** 429 Too Many Requests after limit exceeded

### 2. Login Rate Limit
Make 6+ rapid requests to `/login` endpoint
**Expected:** 429 Too Many Requests after limit exceeded

### 3. OTP Rate Limit
Make 6+ rapid requests to `/verify-email` endpoint
**Expected:** 429 Too Many Requests after limit exceeded

## Postman Collection Import

Create a collection with all the above requests and use this pre-request script for authenticated requests:

**Pre-request Script for authenticated endpoints:**
```javascript
if (!pm.environment.get("access_token")) {
    throw new Error("Access token not found. Please login first.");
}
```

**Global Tests Script:**
```javascript
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

pm.test("Response has required structure", function () {
    const response = pm.response.json();
    pm.expect(response).to.have.property('success');
    pm.expect(response).to.have.property('message');
});

if (pm.response.code >= 400) {
    pm.test("Error response has error details", function () {
        const response = pm.response.json();
        pm.expect(response.success).to.be.false;
    });
}
```

## Environment Setup Script

```javascript
// Run this in Postman Console to set up environment
pm.environment.set("base_url", "http://localhost:3000/api/auth");
pm.environment.set("user_email", "john.doe@example.com");
pm.environment.set("user_phone", "+1234567890");
```

## Notes

1. **OTP Values**: Check server logs or email/SMS for actual OTP values during testing
2. **Rate Limiting**: Wait between requests if you hit rate limits
3. **Database State**: Each test may affect database state, consider using test database
4. **Environment Variables**: Update phone numbers and emails for your testing environment
5. **2FA Testing**: For authenticator app testing, use apps like Google Authenticator with generated QR codes

This comprehensive guide covers all authentication flows with proper error handling and edge case testing.
