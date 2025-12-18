# Auth Integration Guide

Base path: `/api/auth`

This document describes the authentication endpoints, request fields, validation rules, expected responses, and error cases for integrating with the backend authentication API.

## Overview

The backend handles the complete registration and payment flow. The frontend is **not involved in payment processing** — the backend initiates and completes M-Pesa payment automatically.

- Token type: JWT (signed with `JWT_SECRET`). Default expiry: `7d` (configurable via `JWT_EXPIRY`).
- OTP: numeric string (6 digits), expires in 10 minutes.
- **Registration flow**: Backend initiates M-Pesa STK Push (1 KES) automatically. Frontend polls for completion.

## Common response shape

Success responses:

```
{
  "success": true,
  ...endpoint-specific fields
}
```

Error responses:

```
{
  "success": false,
  "error": "Human readable error message"
}
```

## Registration Flow Diagram

```
User → POST /register
        ↓
Backend validates input
        ↓
Backend creates pending transaction (metadata stored)
        ↓
Backend initiates M-Pesa STK Push (1 KES)
        ↓
Response: {status: "payment_initiated", checkoutRequestId, statusCheckUrl}
        ↓
Frontend: User receives M-Pesa prompt on phone
        ↓
Frontend: Poll GET /register/status/:transactionId every 2-3 seconds
        ↓
User completes M-Pesa payment on phone
        ↓
M-Pesa → Backend callback (updates transaction status to "completed")
        ↓
Next poll: GET /register/status/:transactionId
        ↓
Backend auto-completes registration, returns JWT + user
        ↓
Frontend: User logged in
```

## Endpoints

### POST /register

**New behavior: Backend-initiated M-Pesa payment flow**

Initiates registration and automatically starts M-Pesa STK Push payment (1 KES). Does NOT return a `paymentUrl`. Frontend receives a `checkoutRequestId` and `statusCheckUrl` for polling.

Request body (JSON):

Required fields:
- `email` (string) — must be a valid email.
- `password` (string) — minimum 6 characters.
- `phone` (string) — customer phone in international format (e.g., `+2547...`). Required for M-Pesa STK Push.

Optional fields:
- `firstName` (string)
- `lastName` (string)
- `dateOfBirth` (string, ISO date e.g. `1990-01-31`)
- `gender` (string)
- `maritalStatus` (string)
- `spouseName` (string)
- `spouseDob` (string, ISO date)
- `children` (array of objects: `{ name?: string, dob?: string }`)
- `nationalId` (string)
- `address` (string)
- `city` (string)
- `country` (string)
- `occupation` (string)
- `employer` (string)
- `salary` (number)
- `contributionRate` (number)
- `retirementAge` (number)

Validation errors return `400` with the first validation message.

Behavior:
- If `email` already exists → `400` `{ error: 'Email already registered' }`.
- Creates a `transaction` with `amount: 1`, `type: 'registration'`, `status: 'pending'` and saves registration data in `metadata`.
- **Backend automatically calls M-Pesa to initiate STK Push** with the provided `phone`.
- Returns a `checkoutRequestId` (for tracking) and `statusCheckUrl` (for frontend polling).
- Backend waits for M-Pesa callback. When callback arrives with `ResultCode: 0`, the transaction status changes to `completed`.
- Frontend polls `/register/status/:transactionId` until registration is complete.

Success response (200):

```json
{
  "success": true,
  "status": "payment_initiated",
  "message": "Payment initiated. Please check your phone for the M-Pesa prompt.",
  "transactionId": "txn-uuid",
  "checkoutRequestId": "ws_CO_xxxx",
  "statusCheckUrl": "/api/auth/register/status/txn-uuid"
}
```

Errors:
- `400` validation error, email exists, or missing phone
- `500` M-Pesa initiation failed or server error

Client integration notes:
- After receiving `payment_initiated`, prompt the user: *"Check your phone for the M-Pesa payment prompt. Enter your M-Pesa PIN to complete registration."*
- Use `statusCheckUrl` to poll registration status every 2–3 seconds.
- **Do not redirect to an external URL** — all payment happens on the backend.

Sample curl:

```bash
curl -X POST https://api.example.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"alice@example.com",
    "password":"s3cret",
    "phone":"+254712345678",
    "firstName":"Alice"
  }'
```

---

### GET /register/status/:transactionId

**New endpoint for tracking registration & payment status**

Frontend polls this endpoint to check if M-Pesa payment was completed and registration is ready.

Request:
- Path parameter: `transactionId` (returned from `/register`)

Behavior:
- Returns current `status`:
  - `payment_pending` — M-Pesa prompt is pending user action on phone.
  - `payment_completed` — M-Pesa payment succeeded; backend auto-completes registration and returns JWT.
  - `payment_failed` — M-Pesa payment failed; user can retry by calling `/register` again.
  - `registration_completed` — Registration is complete and user is logged in.

Responses:

**Status: payment_pending (200)** — still waiting for payment:

```json
{
  "success": true,
  "status": "payment_pending",
  "message": "Waiting for payment confirmation...",
  "transactionId": "txn-uuid"
}
```

**Status: registration_completed (200)** — user fully registered & JWT returned:

```json
{
  "success": true,
  "status": "registration_completed",
  "message": "Registration completed successfully",
  "token": "<jwt-token>",
  "user": {
    "id": "user-uuid",
    "email": "alice@example.com",
    "firstName": "Alice",
    "lastName": "...",
    "dateOfBirth": "1990-01-01",
    "numberOfChildren": 2
  }
}
```

**Status: payment_failed (200)** — payment did not complete:

```json
{
  "success": false,
  "status": "payment_failed",
  "error": "Payment failed. Please try again.",
  "transactionId": "txn-uuid"
}
```

Errors:
- `404` if `transactionId` not found
- `500` server error

**Frontend polling example (pseudo-code):**

```javascript
async function waitForRegistrationCompletion(transactionId) {
  const maxAttempts = 120; // ~4 minutes at 2-sec interval
  let attempts = 0;

  const poll = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/auth/register/status/${transactionId}`);
      const data = await res.json();

      if (data.status === 'registration_completed') {
        clearInterval(poll);
        localStorage.setItem('token', data.token);
        // redirect to dashboard
        return;
      }

      if (data.status === 'payment_failed') {
        clearInterval(poll);
        showError('Payment failed. Please try again.');
        return;
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        showError('Registration timeout. Please try again.');
        return;
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, 2000); // Poll every 2 seconds
}
```

---

### POST /register/complete
**Deprecated** — no longer used. Backend auto-completes registration on status check after M-Pesa succeeds. Kept for backwards compatibility but will be removed.

### POST /login
Standard password login.

Request body (JSON):
- `identifier` (string) — email or username, required.
- `password` (string) — required.

Behavior:
- Finds user by `email` or `username`.
- Compares provided password with stored hash.
- On failed password: increments `failedLoginAttempts`.
  - If attempts >= 3: generates a 6-digit OTP, stores `otpCode` and `otpExpiry` (10 minutes), sends OTP email, returns `403` with an OTP notice.
- On success: resets `failedLoginAttempts`, clears any `otpCode`/`otpExpiry`, generates JWT and returns user info.

Responses:
- `200` success `{ success:true, token, user: {...} }`
- `401` invalid credentials or invalid OTP
- `403` too many failed attempts — OTP sent to email
- `500` internal

Success example:

```
{
  "success": true,
  "token": "<jwt>",
  "user": { "id":"...","email":"alice@example.com","firstName":"Alice","lastName":"" }
}
```

Sample curl:

```bash
curl -X POST https://api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"alice@example.com","password":"s3cret"}'
```

Notes:
- The server by default locks the account by requiring an OTP after 3 failed attempts.
- OTP is sent via the configured email sending flow.

---

### POST /login/otp
Login using the OTP sent to the user's email.

Request body (JSON):
- `identifier` (string) — email or username, required.
- `otp` (string) — the OTP code, required.

Behavior:
- Verifies the `otp` matches `user.otpCode` and is not expired (`otpExpiry`).
- On success: clears `otpCode` and `otpExpiry`, resets `failedLoginAttempts`, generates JWT and returns token + user.

Responses:
- `200` success `{ success:true, message: 'Login successful', token, user }`
- `401` invalid OTP or expired
- `400` validation errors
- `500` internal

Sample curl:

```bash
curl -X POST https://api.example.com/api/auth/login/otp \
  -H "Content-Type: application/json" \
  -d '{"identifier":"alice@example.com","otp":"123456"}'
```

---

### GET /verify
Verifies a JWT and returns the token payload.

Request:
- Header: `Authorization: Bearer <token>`

Responses:
- `200` `{ success: true, user: <token-payload> }` — token payload includes `userId`, `email`, optional `firstName`, `lastName`, and `age`.
- `401` missing or invalid token
- `500` internal

Sample curl:

```bash
curl -H "Authorization: Bearer <token>" https://api.example.com/api/auth/verify
```

## Field reference (server-side names)
- `email` (string) — unique
- `username` (string) — unique, nullable
- `password` (string) — stored as bcrypt-hash
- `firstName` / `lastName` (string)
- `phone` (string)
- `dateOfBirth` (string, date)
- `gender`, `maritalStatus` (string)
- `spouseName`, `spouseDob` (string date)
- `children` (JSON array of `{name?, dob?}`)
- `numberOfChildren` (int)
- `nationalId`, `address`, `city`, `country` (string)
- `occupation`, `employer` (string)
- `salary`, `contributionRate` (decimal)
- `retirementAge` (int)
- `failedLoginAttempts` (int)
- `otpCode` (string) and `otpExpiry` (timestamp)

## Environment variables and integration guidelines
- `JWT_SECRET` — signing secret for tokens. Change in production.
- `JWT_EXPIRY` — token expiry string (e.g. `7d`, `1h`). Default `7d`.
- `BACKEND_URL` — backend base URL (e.g., `https://api.example.com`). Used internally to call M-Pesa payment endpoints. Required for registration.
- `MPESA_CONSUMER_KEY` — M-Pesa Daraja OAuth consumer key.
- `MPESA_CONSUMER_SECRET` — M-Pesa Daraja OAuth consumer secret.
- `MPESA_SHORTCODE` — M-Pesa business short code.
- `MPESA_PASSKEY` — M-Pesa Lipa Na M-Pesa Online passkey.
- `MPESA_ENV` — `sandbox` or `production`.

Guidelines for frontend integrators:
- **Do NOT redirect to external payment URLs** — the backend handles all M-Pesa communication.
- Validate `email` and `password` client-side before calling `/register`.
- After calling `/register` and receiving `payment_initiated`, display: *"Check your phone for the M-Pesa payment prompt. Confirm to complete registration."*
- Poll `statusCheckUrl` (or `/register/status/{transactionId}`) every 2–3 seconds.
- On `registration_completed`, store the JWT token in secure storage (HTTP-only cookie preferred).
- On `payment_failed`, allow user to retry (call `/register` again with same email).
- Handle long poll timeouts (e.g., >4 minutes) gracefully; suggest user retry.

## M-Pesa Payment Gateway Message Flow (Backend)

When frontend calls `/register`:

1. Backend creates pending transaction (metadata stored in DB).
2. Backend calls `/api/payment/mpesa/initiate` internally:
   - Sends phone, amount (1 KES), transactionId as referenceId.
   - M-Pesa returns `CheckoutRequestID` (STK Push initiated).
3. Backend returns `checkoutRequestId` to frontend + status polling URL.
4. **Message to frontend**: `{ status: "payment_initiated", message: "Check your phone..." }`.
5. M-Pesa shows prompt on user's phone.
6. User enters M-Pesa PIN and completes payment.
7. M-Pesa sends callback to backend webhook (`/api/payment/callback`).
8. Backend webhook updates transaction status to `completed`.
9. Frontend polls `/register/status/:transactionId`.
10. Backend detects `status: completed`, auto-creates user, generates JWT.
11. **Message to frontend**: `{ status: "registration_completed", token, user }`.
12. Frontend stores JWT and redirects to dashboard.

## Error mapping and HTTP status codes
- 200: Operation success
- 400: Bad request / validation errors / missing required fields / invalid transaction state
- 401: Unauthorized — invalid credentials or invalid/expired OTP or missing token
- 403: Forbidden — too many failed attempts; OTP sent to email
- 500: Internal server error

## Security notes
- Passwords are hashed using bcrypt (done at registration time in metadata, used when user is created).
- OTP codes are single-use and expire after 10 minutes.
- M-Pesa callbacks must be verified (check source, validate callback signature if available).
- Rotate `JWT_SECRET` and keep all secrets out of source control.
- **Backend handles all payment** — frontend never sees M-Pesa credentials or payment details.

## Troubleshooting

**"Phone number is required for payment"**
- Ensure `phone` field is provided in request body during registration.

**Frontend stuck on "Waiting for payment confirmation..."**
- Check if M-Pesa prompt appeared on user's phone.
- Verify M-Pesa Daraja credentials are correct and account is active.
- Check backend logs for M-Pesa API errors.
- Ensure `/api/payment/callback` webhook is reachable by M-Pesa.

**"Payment failed" after successful M-Pesa prompt**
- M-Pesa callback may not have reached backend. Check callback logs.
- Retry registration with the same email.

**User never receives M-Pesa prompt**
- Phone number format may be invalid. Ensure international format (e.g., `+2547...`).
- M-Pesa credentials or environment may not be configured correctly.

---

**Summary: Backend-Driven Registration & Payment Flow**

| Step | Actor | Action | Response |
|------|-------|--------|----------|
| 1 | Frontend | POST `/register` with email, password, phone | `payment_initiated` + polling URL |
| 2 | Backend | Initiate M-Pesa STK Push | CheckoutRequestID returned to frontend |
| 3 | User | Complete M-Pesa prompt on phone | M-Pesa callback to backend |
| 4 | Backend | Update transaction to `completed` | (internal) |
| 5 | Frontend | Poll `/register/status/:txnId` | `registration_completed` + JWT |
| 6 | Frontend | Store JWT, redirect to dashboard | User logged in |
