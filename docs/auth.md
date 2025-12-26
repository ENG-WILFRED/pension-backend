# Authentication Documentation

This document provides complete details about authentication endpoints, required data, and expected responses.

## Overview
- Users register and make a payment (1 KES) to activate their account
- Temporary passwords are auto-generated and sent via email and SMS
- A default pension account (MANDATORY type) is automatically created upon registration completion
- Login uses a two-step process: password verification + OTP verification
- Temporary passwords must be exchanged for permanent passwords on first login

---

## 1. REGISTRATION FLOW

### Endpoint: POST /api/auth/register

**Purpose:** Initiate registration and M-Pesa payment

**Required Fields:**
- `email` (string, email format) - User's email address
- `phone` (string) - Phone number for M-Pesa payment

**Optional Fields:**
- `firstName` (string) - User's first name
- `lastName` (string) - User's last name
- `dateOfBirth` (string, ISO date) - User's date of birth
- `gender` (string) - Gender (M/F/Other)
- `maritalStatus` (string) - Marital status
- `spouseName` (string) - Spouse's name (if married)
- `spouseDob` (string, ISO date) - Spouse's date of birth
- `children` (array) - Array of child objects with `name` and `dob`
- `nationalId` (string) - National ID number
- `address` (string) - Physical address
- `city` (string) - City
- `country` (string) - Country
- `occupation` (string) - Job occupation
- `employer` (string) - Employer name
- `salary` (number) - Salary amount
- `contributionRate` (number) - Pension contribution rate
- `retirementAge` (number) - Desired retirement age
- `accountType` (string, enum) - Account type: MANDATORY, VOLUNTARY, EMPLOYER, SAVINGS, WITHDRAWAL, BENEFITS (default: MANDATORY)
- `riskProfile` (string, enum) - Risk profile: LOW, MEDIUM, HIGH (default: MEDIUM)
- `currency` (string) - 3-letter currency code (default: KES)
- `accountStatus` (string, enum) - Account status: ACTIVE, SUSPENDED, CLOSED, FROZEN, DECEASED (default: ACTIVE)
- `kycVerified` (boolean) - KYC verification status (default: false)
- `complianceStatus` (string, enum) - Compliance status: PENDING, APPROVED, REJECTED, SUSPENDED (default: PENDING)

**Request Example:**
```json
{
  "email": "john@example.com",
  "phone": "+254712345678",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-05-15",
  "gender": "M",
  "maritalStatus": "Single",
  "accountType": "MANDATORY",
  "riskProfile": "MEDIUM",
  "currency": "KES",
  "accountStatus": "ACTIVE",
  "kycVerified": false,
  "complianceStatus": "PENDING"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "status": "payment_initiated",
  "message": "Payment initiated. Please check your phone for the M-Pesa prompt.",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "checkoutRequestId": "ws_1234567890",
  "statusCheckUrl": "/api/auth/register/status/550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Email already registered"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to initiate payment. Please try again."
}
```

---

### Endpoint: GET /api/auth/register/status/{transactionId}

**Purpose:** Poll to check payment status and complete registration

**Path Parameters:**
- `transactionId` (string) - Transaction ID from registration initiation

**Response - Payment Still Pending (200):**
```json
{
  "success": true,
  "status": "payment_pending",
  "message": "Waiting for payment confirmation...",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response - Payment Completed & User Created (200):**
```json
{
  "success": true,
  "status": "registration_completed",
  "message": "Registration completed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-05-15",
    "numberOfChildren": 0
  }
}
```

**Response - Payment Failed (200):**
```json
{
  "success": false,
  "status": "payment_failed",
  "error": "Payment failed. Please try again.",
  "transactionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Response - Transaction Not Found (404):**
```json
{
  "success": false,
  "error": "Transaction not found"
}
```

**What Happens After Successful Registration:**
- Temporary password is automatically generated
- Email is sent with temporary password
- SMS is sent with temporary password
- **A pension account is automatically created with the user-provided configuration** (accountType, riskProfile, currency, accountStatus, kycVerified, complianceStatus)
- **Default values are used for any account fields not provided** (accountType: MANDATORY, riskProfile: MEDIUM, currency: KES, accountStatus: ACTIVE, kycVerified: false, complianceStatus: PENDING)
- **Account number is auto-generated in format: `00YYRRRRRRRR`** (e.g., `0025ABCD1234`)
  - `00`: Fixed prefix
  - `YY`: Last 2 digits of year registered (e.g., 25 for 2025)
  - `RRRRRRRR`: 8 random digits (0-9)
- User can login with email/phone + temporary password
- On first login, user must set a permanent password
- The auto-created account is ready for contributions and transactions

---

## 2. LOGIN FLOW

### Step 1: Endpoint: POST /api/auth/login

**Purpose:** Verify password and send OTP

**Required Fields:**
- `identifier` (string) - User's email or phone number
- `password` (string) - User's password (temporary or permanent)

**Request Example:**
```json
{
  "identifier": "john@example.com",
  "password": "abc12345"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

**Error - Invalid Credentials (401):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Error - Account Locked (403):**
```json
{
  "success": false,
  "error": "Account locked due to too many failed login attempts. Please try again later."
}
```

**Error - Validation Error (400):**
```json
{
  "success": false,
  "error": "Invalid request body"
}
```

---

### Step 2: Endpoint: POST /api/auth/login/otp

**Purpose:** Verify OTP and complete login (set permanent password if needed)

- **Required Fields:**
- `identifier` (string) - User's email or phone
- `otp` (string) - 6-digit OTP from email

**Optional Fields:**
- `newPassword` (string) - **REQUIRED** for first-time login with temporary password. Must be at least 6 characters.

**Request Example - Regular Login:**
```json
{
  "identifier": "john@example.com",
  "otp": "123456"
}
```

**Request Example - First-Time Login (Setting Permanent Password):**
```json
{
  "identifier": "john@example.com",
  "otp": "123456",
  "newPassword": "myPermanentPassword123"
}
```

**Success Response - First-Time User (Needs Password) (200):**
```json
{
  "success": true,
  "temporary": true,
  "message": "Please set your permanent password",
  "identifier": "john@example.com"
}
```

**Success Response - Login Complete (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+254712345678",
    "role": "customer"
  }
}
```

**Error - Invalid OTP (401):**
```json
{
  "success": false,
  "error": "Invalid OTP"
}
```

**Error - OTP Expired (401):**
```json
{
  "success": false,
  "error": "OTP has expired"
}
```

**Error - Invalid Password (400):**
```json
{
  "success": false,
  "error": "Password must be at least 6 characters"
}
```

**Error - Too Many Failed Attempts (403):**
```json
{
  "success": false,
  "error": "Too many OTP verification attempts. Please try login again."
}
```

---

## 3. COMPLETE REGISTRATION FLOW DIAGRAM

```
User Registration:
1. POST /api/auth/register
   ↓
2. M-Pesa STK Push on phone
   ↓
3. User enters M-Pesa PIN
   ↓
4. GET /api/auth/register/status/{transactionId} (poll)
   ↓
5. Payment confirmed
   ↓
6. User account created with temporary password
   ↓
7. Email + SMS sent with temporary password
```

---

## 4. COMPLETE LOGIN FLOW DIAGRAM

```
User Login:
1. POST /api/auth/login (email/phone + password)
   ↓
2. Password verified
   ↓
3. OTP generated and sent to email
   ↓
4. Response: "OTP sent to your email"
   ↓
5. POST /api/auth/login/otp (identifier + OTP + optional newPassword)
   ↓
6. If first-time (temp password):
   - Response: "Please set permanent password"
   - Call again with same OTP + newPassword
   ↓
7. OTP verified, permanent password set (if first-time)
   ↓
8. JWT token issued + user data returned
```

---

## 5. AUTHENTICATION HEADER

All authenticated endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

Example:
```
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.example.com/api/dashboard/profile
```

---

## 6. KEY SECURITY NOTES

- OTP codes expire after 10 minutes
- Failed login attempts are tracked (max 5, then account locks)
- Account lockout expires after 15 minutes
- Temporary passwords are single-use
- All passwords are hashed with bcryptjs
- JWT tokens include user ID, email, and role

---

## 7. NOTIFICATIONS SENT

- **During Registration (after payment):**
- **Email:** Contains temporary password and login instructions
- **SMS:** Contains temporary password only

**During Login:**
- **Email:** Contains 6-digit OTP code

---

Generated: 2025-12-24
Updated: 2025-12-24
