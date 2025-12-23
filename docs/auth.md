# Authentication Flow (Auth.md)

This document explains the authentication flow and how external clients should integrate with the API.

## Overview
- Password-based login uses an additional OTP verification step for security.
- New users receive a temporary password during registration (sent via the Notification Service). They must exchange that temporary password for a permanent password during first login.
- The server never returns a token or user data at the initial password check; tokens are issued only after OTP verification.

## Endpoints
1. POST /api/auth/register
   - Creates a registration transaction and (after payment) the user with a temporary password.
   - Notification: A temporary password is sent to the user's email via the Notification Service.

2. POST /api/auth/login
   - Body: `{ "identifier": "user@example.com | username | phone", "password": "..." }`
   - Server verifies the password.
   - If password is correct (temporary or permanent), server generates a one-time code (OTP), saves it on the user with an expiry, and sends it via the Notification Service to the user's email.
   - Response: `200 OK` with `{ "success": true, "message": "OTP sent to your email" }`.
   - No token or user data is returned at this stage.

3. POST /api/auth/login/otp
   - Body: `{ "identifier": "...", "otp": "123456", "newPassword": "optional-for-first-time" }`
   - Server validates the OTP.
   - If the user had a temporary password, `newPassword` is required (>=6 chars). The server will hash and set the permanent password and clear the temporary flag.
   - On success the server issues the JWT token and returns user data: `{ success: true, token, user: {...} }`.

4. POST /api/auth/set-password (optional)
   - Authenticated endpoint to set/change your password after you've obtained a token.
   - Body: `{ "password": "newpass" }`

## Integration Notes
- Clients should follow a two-step login flow:
  1. Call `POST /api/auth/login` with identifier + password. If response indicates OTP sent, prompt the user to check their email.
  2. Call `POST /api/auth/login/otp` with identifier + otp (and `newPassword` if this is the first-time login using a temporary password).
  3. On success store the returned token and user data for authenticated requests.

- Keep the OTP UI separate from the password UI. If the user is using a temporary password, your UI should ask for a new permanent password on the OTP screen.

- Use idempotency and retry when calling the Notification Service. The service returns quickly (202/acknowledged behavior) and delivers asynchronously.

- Secure flows:
  - Protect the `POST /api/auth/login/otp` endpoint against brute-force OTP attempts by rate-limiting and tracking failed attempts (already tracked via `failedLoginAttempts`).
  - Ensure the Notification Service is configured correctly in `NOTIFY_URL` and that emails are delivered.

## Example (client)
1) Start login
```js
await axios.post('/api/auth/login', { identifier: 'alice@example.com', password: 'temporary123' });
// => { success: true, message: 'OTP sent to your email' }
```
2) Complete login (first-time user)
```js
await axios.post('/api/auth/login/otp', { identifier: 'alice@example.com', otp: '123456', newPassword: 'permanentPass123' });
// => { success: true, token: '...', user: {...} }
```

## Notes
- The server stores OTP codes temporarily; they expire after 10 minutes.
- Temporary passwords are single-use: once exchanged for a permanent password during OTP verification, the temporary flag is cleared.

***
Generated: 2025-12-22
