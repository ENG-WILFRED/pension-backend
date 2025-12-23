// @ts-ignore
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pension Management Backend API',
      version: '1.0.0',
      description: 'REST API for pension management system with payment integration',
      contact: {
        name: 'API Support',
        email: 'kimaniwilfred95@gmail.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://pension-backend-rs4h.onrender.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            email: {
              type: 'string',
              format: 'email',
            },
            firstName: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
            phone: {
              type: 'string',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            userId: {
              type: 'string',
            },
            accountId: {
              type: 'string',
              format: 'uuid',
            },
            amount: {
              type: 'number',
              format: 'double',
            },
            type: {
              type: 'string',
              enum: ['registration', 'pension_contribution', 'payment', 'contribution', 'withdrawal_early', 'earnings_interest'],
            },
            status: {
              type: 'string',
              enum: ['pending', 'completed', 'failed'],
            },
            description: {
              type: 'string',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            userId: {
              type: 'string',
              format: 'uuid',
            },
            accountNumber: {
              type: 'string',
            },
            accountType: {
              type: 'string',
              enum: ['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS'],
            },
            accountStatus: {
              type: 'string',
              enum: ['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED'],
            },
            currentBalance: {
              type: 'number',
              format: 'double',
            },
            availableBalance: {
              type: 'number',
              format: 'double',
            },
            lockedBalance: {
              type: 'number',
              format: 'double',
            },
            employeeContributions: {
              type: 'number',
              format: 'double',
            },
            employerContributions: {
              type: 'number',
              format: 'double',
            },
            voluntaryContributions: {
              type: 'number',
              format: 'double',
            },
            interestEarned: {
              type: 'number',
              format: 'double',
            },
            investmentReturns: {
              type: 'number',
              format: 'double',
            },
            dividendsEarned: {
              type: 'number',
              format: 'double',
            },
            totalWithdrawn: {
              type: 'number',
              format: 'double',
            },
            riskProfile: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH'],
            },
            kycVerified: {
              type: 'boolean',
            },
            complianceStatus: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoint',
      },
      {
        name: 'Authentication',
        description: 'User registration, login, and token verification operations',
      },
      {
        name: 'Accounts',
        description: 'Pension account management - create, view, contribute, withdraw, and manage balances',
      },
      {
        name: 'Payments',
        description: 'Payment initiation, status checking, and M-Pesa callbacks',
      },
      {
        name: 'Dashboard',
        description: 'User profile, transactions, and statistics',
      },
    ],
  },
  apis: [
    './src/routes/health.ts',
    './src/routes/auth/register.ts',
    './src/routes/auth/promote.ts',
    './src/routes/auth/login.ts',
    './src/routes/accounts.ts',
    './src/routes/users.ts',
    './src/routes/payment/index.ts',
    './src/routes/payment/handlers/initiate.ts',
    './src/routes/payment/handlers/status.ts',
    './src/routes/payment/handlers/callback.ts',
    './src/routes/dashboard.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
