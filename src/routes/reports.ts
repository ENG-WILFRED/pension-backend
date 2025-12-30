import express, { Request, Response } from 'express';
import AppDataSource from '../lib/data-source';
import { Report } from '../entities/Report';
import { generateTransactionPdf, generateCustomerPdf } from '../lib/pdf';
import requireAuth from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/reports/generate-transaction
 * Generate and save a transaction report as base64 PDF
 */
router.post('/generate-transaction', requireAuth, async (req: Request, res: Response) => {
  try {
    const { transactions, title } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ success: false, error: 'transactions array is required' });
    }

    const buffer = await generateTransactionPdf(transactions, title);
    const pdfBase64 = buffer.toString('base64');
    const reportRepository = AppDataSource.getRepository(Report);

    const report = reportRepository.create({
      type: 'transactions',
      title: title || 'Transactions Report',
      pdfBase64,
      metadata: { transactionCount: transactions.length },
    });

    await reportRepository.save(report);

    res.json({
      success: true,
      reportId: report.id,
      message: 'Transaction report generated and saved successfully',
    });
  } catch (error) {
    console.error('Error generating transaction report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate transaction report' });
  }
});

/**
 * POST /api/reports/generate-customer
 * Generate and save a customer report as base64 PDF
 */
router.post('/generate-customer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { user, transactions, title } = req.body;

    if (!user) {
      return res.status(400).json({ success: false, error: 'user object is required' });
    }
    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ success: false, error: 'transactions array is required' });
    }

    const buffer = await generateCustomerPdf(user, transactions, title);
    const pdfBase64 = buffer.toString('base64');
    const reportRepository = AppDataSource.getRepository(Report);

    const report = reportRepository.create({
      type: 'customer',
      title: title || 'Customer Report',
      pdfBase64,
      metadata: { userId: user.id, transactionCount: transactions.length },
    });

    await reportRepository.save(report);

    res.json({
      success: true,
      reportId: report.id,
      message: 'Customer report generated and saved successfully',
    });
  } catch (error) {
    console.error('Error generating customer report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate customer report' });
  }
});

/**
 * GET /api/reports/:id
 * Retrieve a report by ID with base64 PDF
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
  const reportRepository = AppDataSource.getRepository(Report);

    const report = await reportRepository.findOne({
      where: { id },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error retrieving report:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve report' });
  }
});

/**
 * GET /api/reports
 * List all reports
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const reportRepository = AppDataSource.getRepository(Report);
    const reports = await reportRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error('Error listing reports:', error);
    res.status(500).json({ success: false, error: 'Failed to list reports' });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report by ID
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
    const reportRepository = AppDataSource.getRepository(Report);
  try {
    const { id } = req.params;

    const result = await reportRepository.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ success: false, error: 'Failed to delete report' });
  }
});

export default router;
