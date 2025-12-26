import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './lib/swagger';
import AppDataSource from './lib/data-source';
// Routes will be dynamically imported after the DataSource initializes to ensure
// entity metadata is registered before repositories are accessed.

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  credentials: false,
}));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: {
    url: '/swagger.json',
  },
}));

// Swagger JSON endpoint
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Initialize DB and then mount routes
AppDataSource.initialize().then(async () => {
  console.log('Database initialized');

  const authRoutes = (await import('./routes/auth')).default;
  const userRoutes = (await import('./routes/users')).default;
  const accountRoutes = (await import('./routes/accounts')).default;
  const accountTypeRoutes = (await import('./routes/account-types')).default;
  const paymentRoutes = (await import('./routes/payment')).default;
  const dashboardRoutes = (await import('./routes/dashboard')).default;
  const healthRoutes = (await import('./routes/health')).default;
  const termsAndConditionsRoutes = (await import('./routes/terms-and-conditions')).default;

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/account-types', accountTypeRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/terms-and-conditions', termsAndConditionsRoutes);
  app.use('/api', healthRoutes);

  // Start server after DB initialized and routes mounted
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📡 CORS enabled for ${FRONTEND_URL}`);
  });
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Note: server is started after DB initialization above.
