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
    paths: {
      '/api/reports/generate-transaction': {
        post: {
          tags: ['Reports'],
          summary: 'Generate a transactions PDF report and save it as base64',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateTransactionRequest' },
                examples: {
                  example1: {
                    value: {
                      title: 'Monthly Transactions',
                      transactions: [
                        { id: 'tx1', type: 'payment', amount: 100.5, status: 'completed', createdAt: new Date().toISOString() },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Report generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerateResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/reports/generate-customer': {
        post: {
          tags: ['Reports'],
          summary: 'Generate a customer PDF report and save it as base64',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateCustomerRequest' },
                examples: {
                  example1: {
                    value: {
                      title: 'Customer Report',
                      user: { id: 'user1', email: 'jane@example.com', firstName: 'Jane', lastName: 'Doe' },
                      transactions: [],
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Report generated', content: { 'application/json': { schema: { $ref: '#/components/schemas/GenerateResponse' } } } },
            '400': { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/reports': {
        get: {
          tags: ['Reports'],
          summary: 'List reports',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'List of reports', content: { 'application/json': { schema: { $ref: '#/components/schemas/ReportListResponse' } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/reports/{id}': {
        get: {
          tags: ['Reports'],
          summary: 'Get report by id',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': { description: 'Report', content: { 'application/json': { schema: { $ref: '#/components/schemas/Report' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          tags: ['Reports'],
          summary: 'Delete report by id',
          security: [{ bearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            '200': { description: 'Deleted', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
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
        Report: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string', description: "'transactions' or 'customer'" },
            title: { type: 'string' },
            fileName: { type: 'string' },
            pdfBase64: { type: 'string', description: 'Base64 encoded PDF string' },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        GenerateTransactionRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Transactions Report' },
            transactions: {
              type: 'array',
              items: { $ref: '#/components/schemas/Transaction' },
            },
          },
          required: ['transactions'],
        },
        GenerateCustomerRequest: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Customer Report' },
            user: { $ref: '#/components/schemas/User' },
            transactions: {
              type: 'array',
              items: { $ref: '#/components/schemas/Transaction' },
            },
          },
          required: ['user', 'transactions'],
        },
        GenerateResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            reportId: { type: 'string', format: 'uuid' },
            message: { type: 'string' },
          },
        },
        ReportListResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Report' } },
          },
        },
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
        TermsAndConditions: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            body: {
              type: 'string',
              description: 'HTML formatted terms and conditions content',
            },
            createdDate: {
              type: 'string',
              format: 'date-time',
            },
            updatedDate: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        AccountType: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            name: {
              type: 'string',
              description: 'Unique name for the account type',
              example: 'MANDATORY',
            },
            description: {
              type: 'string',
              description: 'Human-friendly description of account type',
              example: 'Default mandatory pension account',
            },
            interestRate: {
              type: 'number',
              format: 'decimal',
              description: 'Default interest rate as percentage',
              example: 3.5,
            },
            active: {
              type: 'boolean',
              default: true,
              description: 'Whether this account type is active',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
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
      {
        name: 'Terms and Conditions',
        description: 'Retrieve and update terms and conditions documents',
      },
      {
        name: 'Reports',
        description: 'Generate, list, retrieve and delete PDF reports (stored as base64)',
      },
    ],
  },
  apis: [
    './src/routes/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
