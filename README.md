# Backend API

This is the Node.js/Express backend for the Pension Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. Set up Prisma:
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Run development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/register/complete` - Complete registration after payment
- `POST /api/auth/login` - Login user
- `GET /api/auth/verify` - Verify authentication token

### Payment
- `POST /api/payment/initiate` - Initiate pension contribution (requires auth)
- `GET /api/payment/status/:transactionId` - Get transaction status
- `POST /api/payment/callback` - Gateway callback endpoint

### Health
- `GET /api/health` - Health check

## Environment Variables

See `.env.example` for all required variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing JWT tokens
- `PAYMENT_GATEWAY_URL` - External payment gateway URL
- `FRONTEND_URL` - Frontend application URL (for CORS)
