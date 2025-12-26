# Accounts

This document describes the account types and account creation flows for admins and customers.

## Account Types (Admin)

Admins can create account types which control defaults for customer accounts. Each account type has:
- `name` (string, unique) — identifier used internally (e.g. MANDATORY)
- `description` (string) — human-friendly description
- `interestRate` (number) — default interest rate (percentage, e.g. `3.50`)

### Create account type (Admin)
- Endpoint: `POST /api/account-types`
- Auth: Bearer token (admin only)
- Body:
  - `name` (string, required)
  - `description` (string, optional)
  - `interestRate` (number, optional)

Response on success (201):
```json
{
  "success": true,
  "accountType": {
    "id": "uuid",
    "name": "MANDATORY",
    "description": "Default mandatory pension account",
    "interestRate": 3.5,
    "active": true
  }
}
```

## Customer account creation

When creating a customer account (`POST /api/accounts`), clients may now either:
- Provide `accountTypeId` (uuid) — an admin-created account type. If present, the account will inherit the account type `name` and default `interestRate` unless an explicit `interestRate` is provided.
- Provide the legacy `accountType` enum value (one of `MANDATORY`, `VOLUNTARY`, `EMPLOYER`, `SAVINGS`, `WITHDRAWAL`, `BENEFITS`).

Other fields remain the same (e.g. `riskProfile`, `investmentPlanId`, `currency`).

If an invalid `accountTypeId` is provided, the API returns `400` with an error message.

## Account Number Format

When an account is created the system assigns a numeric account id (auto-increment integer). The public `accountNumber` is derived from that id by zero-padding to 8 digits. For example, if the numeric `id` is `123`, the `accountNumber` will be `00000123`.

- `accountNumber` format: 8-digit zero-padded numeric string (e.g. `00000001`, `00000123`)
- The numeric `id` is the authoritative primary key of the account (integer).
- The database enforces uniqueness on `accountNumber`.

This format keeps account numbers simple, numeric, and easy to reconcile with the internal account id.

## Examples

Create account using admin-created type id:

```json
{
  "accountTypeId": "<uuid>",
  "investmentPlanId": "<plan-uuid>",
  "currency": "KES"
}
```

Create account using legacy enum:

```json
{
  "accountType": "VOLUNTARY",
  "riskProfile": "MEDIUM"
}
```
