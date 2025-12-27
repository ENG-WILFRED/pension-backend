# Password and PIN Management

This document describes endpoints for managing passwords and PINs, including change and reset flows.

---

## Password Management

### Change Password (Authenticated)

**Endpoint:** `POST /api/auth/change-password`

**Purpose:** Allow authenticated users to change their password by verifying the current password first.

**Auth Required:** Bearer token (authenticated user only)

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Required Fields:**
- `currentPassword` (string) - User's current password (must match existing password hash)
- `newPassword` (string, min 6 characters) - New password to set

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `400` - Invalid input or incorrect current password
- `401` - Unauthorized (invalid or missing token)
- `404` - User not found
- `500` - Internal server error

---

### Forgot Password Flow

#### Step 1: Request Password Reset OTP

**Endpoint:** `POST /api/auth/forgot-password`

**Purpose:** Unauthenticated user requests a password reset OTP sent to their email.

**No Auth Required**

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Required Fields:**
- `email` (string) - User's registered email address

**What Happens:**
1. System generates a 6-digit OTP
2. OTP is stored with 10-minute expiry
3. OTP is sent to user's email via the notification service using the `password-reset` template
4. User checks email for the OTP

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

**Error Responses:**
- `404` - User not found
- `500` - Failed to send notification

---

#### Step 2: Verify OTP and Reset Password

**Endpoint:** `POST /api/auth/forgot-password/verify`

**Purpose:** Verify the OTP and set a new password.

**No Auth Required**

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newPassword456"
}
```

**Required Fields:**
- `email` (string) - User's registered email address
- `otp` (string, 6 digits) - OTP received via email
- `newPassword` (string, min 6 characters) - New password to set

**What Happens:**
1. System verifies OTP matches and has not expired
2. OTP is cleared from user record
3. New password is hashed and stored
4. `passwordIsTemporary` flag is set to `false`
5. User can now login with their new password

**Success Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses:**
- `400` - Invalid input or OTP mismatch
- `401` - OTP expired or invalid
- `500` - Internal server error

---

## PIN Management

### Change PIN (Authenticated)

**Endpoint:** `POST /api/auth/change-pin`

**Purpose:** Allow authenticated users to change their 4-digit PIN by verifying the current PIN first.

**Auth Required:** Bearer token (authenticated user only)

**Request Body:**
```json
{
  "currentPin": "1234",
  "newPin": "5678"
}
```

**Required Fields:**
- `currentPin` (string, 4 digits) - User's current PIN (must match existing PIN hash)
- `newPin` (string, exactly 4 digits) - New PIN to set

**Notes:**
- PIN must be exactly 4 digits (0-9)
- PIN must not be already set on the account (will return 401 if not set)

**Success Response (200):**
```json
{
  "success": true,
  "message": "PIN changed successfully"
}
```

**Error Responses:**
- `400` - Invalid input, incorrect current PIN, or invalid PIN format
- `401` - Unauthorized or PIN not set on account
- `500` - Internal server error

---

### Reset PIN Flow

#### Step 1: Request PIN Reset OTP

**Endpoint:** `POST /api/auth/reset-pin`

**Purpose:** Unauthenticated user requests a PIN reset OTP sent to their phone via SMS.

**No Auth Required**

**Request Body:**
```json
{
  "phone": "+254712345678"
}
```

**Required Fields:**
- `phone` (string) - User's registered phone number

**What Happens:**
1. System generates a 6-digit OTP
2. OTP is stored with 10-minute expiry
3. OTP is sent to user's phone via SMS using the notification service with the `pin-reset` template
4. User checks SMS for the OTP

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your phone"
}
```

**Error Responses:**
- `404` - User not found
- `500` - Failed to send SMS notification

---

#### Step 2: Verify OTP and Reset PIN

**Endpoint:** `POST /api/auth/reset-pin/verify`

**Purpose:** Verify the OTP and set a new PIN.

**No Auth Required**

**Request Body:**
```json
{
  "phone": "+254712345678",
  "otp": "123456",
  "newPin": "5678"
}
```

**Required Fields:**
- `phone` (string) - User's registered phone number
- `otp` (string, 6 digits) - OTP received via SMS
- `newPin` (string, exactly 4 digits) - New PIN to set

**What Happens:**
1. System verifies OTP matches and has not expired
2. OTP is cleared from user record
3. New PIN is hashed and stored
4. User can now use the new PIN to login via phone

**Success Response (200):**
```json
{
  "success": true,
  "message": "PIN reset successfully"
}
```

**Error Responses:**
- `400` - Invalid input or invalid PIN format
- `401` - OTP expired or invalid
- `404` - User not found
- `500` - Internal server error

---

## Notification Templates

All password and PIN reset flows use the external notification service with the following templates:

### password-reset Template
- **Channel:** Email
- **Data Required:** `name`, `otp`
- **Used By:** Forgot password endpoint (`/api/auth/forgot-password`)

### pin-reset Template
- **Channel:** SMS
- **Data Required:** `name`, `otp`
- **Used By:** Reset PIN endpoint (`/api/auth/reset-pin`)

---

## Security Notes

- OTP codes expire after 10 minutes
- OTP is single-use; once verified, it's cleared
- All passwords and PINs are hashed using bcryptjs before storage
- PIN change requires verification of current PIN to prevent unauthorized changes
- Password change requires verification of current password to prevent unauthorized changes
- Forgot password/PIN flows are rate-limited by IP in production (recommended)

---

Generated: 2025-12-27
