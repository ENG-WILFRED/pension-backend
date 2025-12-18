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
            amount: {
              type: 'number',
              format: 'double',
            },
            type: {
              type: 'string',
              enum: ['registration', 'pension_contribution'],
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
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoint',
      },
      {
        name: 'Authentication',
        description: 'User registration and login operations',
      },
      {
        name: 'Payments',
        description: 'Payment and pension contribution operations',
      },
    ],
  },
  apis: [
    './src/routes/health.ts',
    './src/routes/auth/register.ts',
    './src/routes/auth/login.ts',
    './src/routes/payment/index.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
