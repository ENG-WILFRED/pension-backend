import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import { User } from '../../entities/User';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import PDFDocument from 'pdfkit';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const transactionRepo = AppDataSource.getRepository(Transaction);
const userRepo = AppDataSource.getRepository(User);

// ─── BRAND COLORS ─────────────────────────────────────────────────────────────
const NAVY = '#0D2B45';
const NAVY_MID = '#1B4965';
const ORANGE = '#F18F01';
const ORANGE_LITE = '#FFF4E0';
const STEEL = '#E8EEF4';
const MID_GRAY = '#8FA3B1';
const DARK_TEXT = '#1A2733';
const BODY_TEXT = '#3D5166';
const SUCCESS = '#1A9E62';
const WARNING = '#E67E22';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatDate(date: Date, fmt: string): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear());
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return fmt
    .replace('DD', d)
    .replace('MMM', months[date.getMonth()])
    .replace('MM', m)
    .replace('YYYY', y)
    .replace('dd', d)
    .replace('MM', m)
    .replace('yyyy', y);
}

function fmtMoney(val: any): string {
  return `KES ${Number(val ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ─── SECTION RULE ────────────────────────────────────────────────────────────
function drawSectionRule(doc: any, label: string, y: number): void {
  const L = 50;
  const R = doc.page.width - 50;

  doc.rect(L, y + 2, 4, 14).fill(ORANGE);

  doc.fillColor(DARK_TEXT).font('Helvetica-Bold').fontSize(10).text(label.toUpperCase(), L + 12, y + 4, { lineBreak: false });

  const labelW = label.length * 6.2 + L + 12;
  doc.moveTo(labelW + 8, y + 11).lineTo(R, y + 11).strokeColor(STEEL).lineWidth(0.8).stroke();
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function drawKpiCard(doc: any, x: number, y: number, w: number, h: number, label: string, value: string): void {
  doc.rect(x, y, w, h).fill(ORANGE_LITE);
  doc.rect(x, y, w, 2).fill(ORANGE);
  doc.rect(x, y, w, h).stroke(STEEL).lineWidth(0.5);

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7).text(label, x, y + 10, { width: w, align: 'center', lineBreak: false });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(value, x, y + 24, { width: w, align: 'center', lineBreak: false });
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function drawStatusBadge(doc: any, status: string, x: number, y: number): void {
  const isOk = ['completed', 'active'].includes((status ?? '').toLowerCase());
  const color = isOk ? SUCCESS : WARNING;
  const bullet = isOk ? '●' : '○';
  doc.fillColor(color).font('Helvetica-Bold').fontSize(7.5).text(`${bullet} ${(status ?? 'PENDING').toUpperCase()}`, x, y, { lineBreak: false });
}

// ─── TABLE ROW ────────────────────────────────────────────────────────────────
function drawTableRow(
  doc: any,
  cols: { x: number; width: number; text: string; align?: 'left' | 'right' | 'center'; bold?: boolean; color?: string }[],
  y: number,
  rowHeight: number,
  bg?: string
): void {
  if (bg) {
    doc.rect(40, y, doc.page.width - 80, rowHeight).fill(bg);
  }
  for (const col of cols) {
    doc
      .fillColor(col.color ?? BODY_TEXT)
      .font(col.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(8.5)
      .text(col.text, col.x, y + 6, {
        width: col.width,
        align: col.align ?? 'left',
        lineBreak: false,
      });
  }
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function drawFooter(doc: any, pageNum: number, totalPages: number, dateFormat: string): void {
  const y = doc.page.height - 28;
  const W = doc.page.width;

  doc.rect(0, y, W, 28).fill(STEEL);
  doc.moveTo(0, y).lineTo(W, y).strokeColor(ORANGE).lineWidth(1).stroke();
  doc.rect(0, doc.page.height - 4, W, 4).fill(NAVY);

  const generated = formatDate(new Date(), dateFormat);
  doc.fillColor(BODY_TEXT).font('Helvetica').fontSize(7).text(`Generated: ${generated}  |  AUTONEST Pension Management System  |  support@autonest.com`, 15, y + 8, { lineBreak: false });

  doc.fillColor(NAVY_MID).font('Helvetica-Bold').fontSize(7).text(`Page ${pageNum} of ${totalPages}`, 0, y + 8, {
    width: W - 15,
    align: 'right',
    lineBreak: false,
  });
}

// ─── HEADER BANNER ────────────────────────────────────────────────────────────
function drawHeader(doc: any, startDate: Date, endDate: Date, dateFormat: string): void {
  const W = doc.page.width;
  const H = 90;

  doc.rect(0, 0, W, H).fill(NAVY);
  doc.rect(0, 0, 5, H).fill(ORANGE);

  const cx = 38;
  const cy = 32;
  const r = 15;
  doc.circle(cx, cy, r).fill(ORANGE);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text('AN', cx - 11, cy - 6, { width: 22, align: 'center', lineBreak: false });

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('AUTONEST', 62, 18, { lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(9).text('Pension Management System', 62, 44, { lineBreak: false });

  doc.moveTo(62, 58).lineTo(230, 58).strokeColor(ORANGE).lineWidth(1.5).stroke();

  const rightX = W - 220;
  doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(12).text('CONTRIBUTION STATEMENT', rightX, 18, { width: 205, align: 'right', lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(8).text('Statement Period', rightX, 40, { width: 205, align: 'right', lineBreak: false });

  const period = `${formatDate(startDate, dateFormat)}  –  ${formatDate(endDate, dateFormat)}`;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(period, rightX, 54, { width: 205, align: 'right', lineBreak: false });

  doc.moveTo(0, H).lineTo(W, H).strokeColor(ORANGE).lineWidth(2).stroke();
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

async function generateContributionStatementPdf(
  user: any,
  account: any,
  transactions: any[],
  startDate: Date,
  endDate: Date,
  dateFormat: string
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const L = 50;
  const R = PAGE_W - 50;
  const USABLE_W = R - L;
  const BOTTOM_LIMIT = PAGE_H - 50;

  let currentPage = 1;
  let totalPages = 1;

  // ─── DRAW HEADER ────────────────────────────────────────────────────────
  drawHeader(doc, startDate, endDate, dateFormat);

  let curY = 108;

  // ─── SECTION: ACCOUNT INFORMATION ───────────────────────────────────────
  drawSectionRule(doc, 'Account Information', curY);
  curY += 28;

  const cardH = 100;
  const halfW = USABLE_W / 2;

  doc.rect(L, curY, USABLE_W, cardH).fill(STEEL);

  doc.moveTo(L + halfW, curY + 8).lineTo(L + halfW, curY + cardH - 8).strokeColor(MID_GRAY).lineWidth(0.5).stroke();

  const lx = L + 10;
  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('ACCOUNT HOLDER', lx, curY + 8, { lineBreak: false });
  doc.fillColor(DARK_TEXT).font('Helvetica-Bold').fontSize(11).text(`${user.firstName ?? ''} ${user.lastName ?? ''}`, lx, curY + 22, { lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('EMAIL ADDRESS', lx, curY + 44, { lineBreak: false });
  doc.fillColor(BODY_TEXT).font('Helvetica').fontSize(9).text(user.email ?? 'N/A', lx, curY + 56, { lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('PHONE NUMBER', lx, curY + 72, { lineBreak: false });
  doc.fillColor(BODY_TEXT).font('Helvetica').fontSize(9).text(user.phone ?? 'N/A', lx, curY + 84, { lineBreak: false });

  const rx = L + halfW + 12;
  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('ACCOUNT NUMBER', rx, curY + 8, { lineBreak: false });
  doc.fillColor(DARK_TEXT).font('Helvetica-Bold').fontSize(11).text(account.accountNumber ?? 'N/A', rx, curY + 22, { lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('ACCOUNT TYPE', rx, curY + 44, { lineBreak: false });
  doc.fillColor(BODY_TEXT).font('Helvetica').fontSize(9).text(account.accountType ?? 'N/A', rx, curY + 56, { lineBreak: false });

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text('ACCOUNT STATUS', rx, curY + 72, { lineBreak: false });
  drawStatusBadge(doc, account.accountStatus ?? 'N/A', rx, curY + 84);

  curY += cardH + 18;

  // ─── SECTION: ACCOUNT SUMMARY ────────────────────────────────────────────
  drawSectionRule(doc, 'Account Summary', curY);
  curY += 28;

  const kpiData = [
    { label: 'CURRENT BALANCE', key: 'currentBalance' },
    { label: 'EMPLOYEE CONTRIBUTIONS', key: 'employeeContributions' },
    { label: 'EMPLOYER CONTRIBUTIONS', key: 'employerContributions' },
    { label: 'VOLUNTARY CONTRIBUTIONS', key: 'voluntaryContributions' },
  ];

  const kpiW = (USABLE_W - 3 * 6) / 4;
  const kpiH = 52;
  let kpiX = L;

  for (const kpi of kpiData) {
    drawKpiCard(doc, kpiX, curY, kpiW, kpiH, kpi.label, fmtMoney(account[kpi.key] ?? 0));
    kpiX += kpiW + 6;
  }

  curY += kpiH + 20;

  // ─── SECTION: CONTRIBUTION HISTORY ───────────────────────────────────────
  drawSectionRule(doc, 'Contribution History', curY);
  curY += 28;

  if (transactions.length === 0) {
    doc.fillColor(MID_GRAY).font('Helvetica').fontSize(9).text('No contributions were found for the selected period.', L, curY);
    curY += 20;
  } else {
    const COL = {
      date: { x: L, w: 75 },
      type: { x: L + 75, w: 90 },
      desc: { x: L + 165, w: 175 },
      amount: { x: L + 340, w: 100 },
      status: { x: L + 440, w: 55 },
    };

    const ROW_H = 24;
    const headerY = curY;

    doc.rect(40, headerY, PAGE_W - 80, ROW_H + 4).fill(NAVY);
    doc.rect(40, headerY, PAGE_W - 80, 2).fill(ORANGE);

    const headerCols = [
      { x: COL.date.x, width: COL.date.w, text: 'DATE', align: 'left' as const, bold: true, color: '#FFFFFF' },
      { x: COL.type.x, width: COL.type.w, text: 'TYPE', align: 'left' as const, bold: true, color: '#FFFFFF' },
      { x: COL.desc.x, width: COL.desc.w, text: 'DESCRIPTION', align: 'left' as const, bold: true, color: '#FFFFFF' },
      { x: COL.amount.x, width: COL.amount.w, text: 'AMOUNT (KES)', align: 'right' as const, bold: true, color: '#FFFFFF' },
      { x: COL.status.x, width: COL.status.w, text: 'STATUS', align: 'center' as const, bold: true, color: '#FFFFFF' },
    ];
    drawTableRow(doc, headerCols, headerY + 1, ROW_H + 2);
    curY += ROW_H + 6;

    let totalAmount = 0;
    let rowIndex = 0;

    for (const txn of transactions) {
      const amount = Number(txn.amount ?? 0);
      totalAmount += amount;
      const txnDate = formatDate(new Date(txn.createdAt), dateFormat);
      const bg = rowIndex % 2 === 0 ? '#FFFFFF' : STEEL;

      if (curY + ROW_H > BOTTOM_LIMIT) {
        drawFooter(doc, currentPage, 999, dateFormat);
        doc.addPage();
        currentPage++;
        curY = 50;

        doc.rect(0, 0, PAGE_W, 4).fill(ORANGE);

        doc.rect(40, curY, PAGE_W - 80, ROW_H + 4).fill(NAVY);
        doc.rect(40, curY, PAGE_W - 80, 2).fill(ORANGE);
        drawTableRow(doc, headerCols, curY + 1, ROW_H + 2);
        curY += ROW_H + 6;
        rowIndex = 0;
      }

      doc.rect(40, curY, PAGE_W - 80, ROW_H).fill(bg);

      doc.moveTo(40, curY + ROW_H).lineTo(PAGE_W - 40, curY + ROW_H).strokeColor(STEEL).lineWidth(0.4).stroke();

      doc.fillColor(BODY_TEXT).font('Helvetica').fontSize(8.5);
      doc.text(txnDate, COL.date.x, curY + 6, { width: COL.date.w, align: 'left', lineBreak: false });
      doc.text((txn.type ?? 'CONTRIBUTION').toUpperCase(), COL.type.x, curY + 6, { width: COL.type.w, align: 'left', lineBreak: false });
      doc.text((txn.description ?? 'N/A').substring(0, 40), COL.desc.x, curY + 6, { width: COL.desc.w, align: 'left', lineBreak: false });
      doc.fillColor(DARK_TEXT).font('Helvetica-Bold').text(amount.toLocaleString('en-KE', { minimumFractionDigits: 2 }), COL.amount.x, curY + 6, { width: COL.amount.w, align: 'right', lineBreak: false });

      drawStatusBadge(doc, txn.status ?? 'completed', COL.status.x, curY + 7);

      curY += ROW_H;
      rowIndex++;
    }

    doc.rect(40, curY, PAGE_W - 80, ROW_H + 4).fill(ORANGE_LITE);
    doc.moveTo(40, curY).lineTo(PAGE_W - 40, curY).strokeColor(ORANGE).lineWidth(1.5).stroke();
    doc.moveTo(40, curY + ROW_H + 4).lineTo(PAGE_W - 40, curY + ROW_H + 4).strokeColor(ORANGE).lineWidth(0.5).stroke();

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9).text('TOTAL CONTRIBUTIONS', COL.date.x, curY + 8, { lineBreak: false });

    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(9).text(totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 }), COL.amount.x, curY + 8, { width: COL.amount.w, align: 'right', lineBreak: false });

    curY += ROW_H + 16;
  }

  if (curY + 55 > BOTTOM_LIMIT) {
    drawFooter(doc, currentPage, 999, dateFormat);
    doc.addPage();
    currentPage++;
    curY = 50;
  }

  curY += 10;

  const disclaimer =
    'This statement is generated automatically by AUTONEST Pension Management System and is provided for informational purposes only. Figures are subject to final audit and reconciliation. For disputes or queries, please contact your pension administrator or write to support@autonest.com.';

  const disclaimerH = 50;
  doc.rect(L, curY, USABLE_W, disclaimerH).fill(STEEL);
  doc.rect(L, curY, 3, disclaimerH).fill(ORANGE);

  doc.fillColor(MID_GRAY).font('Helvetica').fontSize(7.5).text(disclaimer, L + 12, curY + 8, { width: USABLE_W - 20, align: 'left' });

  totalPages = currentPage;
  drawFooter(doc, totalPages, totalPages, dateFormat);

  doc.end();
  return streamToBuffer(doc);
}

/**
 * @swagger
 * /api/accounts/{id}/statement/download:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Download contribution statement as PDF
 *     description: Generate and download a PDF contribution statement for a specific account. Allows filtering by date range and custom date formatting.
 *     operationId: downloadContributionStatement
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Account ID (numeric)
 *         schema:
 *           type: integer
 *           example: 1
 *       - name: startDate
 *         in: query
 *         required: false
 *         description: Start date for statement (YYYY-MM-DD format). Defaults to 30 days ago.
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-17"
 *       - name: endDate
 *         in: query
 *         required: false
 *         description: End date for statement (YYYY-MM-DD format). Defaults to today.
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-02-17"
 *       - name: dateFormat
 *         in: query
 *         required: false
 *         description: Date format for PDF display
 *         schema:
 *           type: string
 *           enum: 
 *             - dd/MM/yyyy
 *             - yyyy-MM-dd
 *             - MM/dd/yyyy
 *             - dd-MM-yyyy
 *           default: dd/MM/yyyy
 *           example: "yyyy-MM-dd"
 *     responses:
 *       '200':
 *         description: PDF statement file downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: File download header
 *             schema:
 *               type: string
 *               example: 'attachment; filename="contribution_statement_DF-2026-000000001_2026-02-17.pdf"'
 *       '400':
 *         description: Invalid input (invalid account ID, invalid date range, or invalid date format)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid dateFormat. Must be one of: dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy, dd-MM-yyyy"
 *       '401':
 *         description: Unauthorized or invalid/missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       '404':
 *         description: Account not found or user does not own this account
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Account not found"
 *       '500':
 *         description: Server error during PDF generation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/:id/statement/download', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });

    const userId = (req.user as any).userId;

    // Query parameters
    const { startDate, endDate, dateFormat = 'dd/MM/yyyy' } = req.query;

    // Validate date format
    const validFormats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'dd-MM-yyyy'];
    if (!validFormats.includes(dateFormat as string)) {
      return res.status(400).json({
        success: false,
        error: `Invalid dateFormat. Must be one of: ${validFormats.join(', ')}`,
      });
    }

    // Parse dates
    let start = new Date();
    start.setDate(start.getDate() - 30); // Default to 30 days ago
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    end.setHours(23, 59, 59, 999); // End of today

    if (startDate) {
      const parsed = new Date(startDate as string);
      if (!isNaN(parsed.getTime())) {
        start = parsed;
        start.setHours(0, 0, 0, 0);
      }
    }

    if (endDate) {
      const parsed = new Date(endDate as string);
      if (!isNaN(parsed.getTime())) {
        end = parsed;
        end.setHours(23, 59, 59, 999);
      }
    }

    // Validate date range
    if (start > end) {
      return res.status(400).json({ success: false, error: 'startDate must be before endDate' });
    }

    // Fetch account and verify ownership
    const account = await accountRepo.findOne({
      where: { id, userId },
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Fetch user
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Fetch transactions within date range
    const query = AppDataSource.createQueryBuilder(Transaction, 'txn')
      .where('txn.accountId = :accountId', { accountId: id })
      .andWhere('txn.createdAt >= :start', { start })
      .andWhere('txn.createdAt <= :end', { end })
      .orderBy('txn.createdAt', 'DESC');

    const transactions = await query.getMany();

    // Generate PDF
    const pdfBuffer = await generateContributionStatementPdf(
      user,
      account,
      transactions,
      start,
      end,
      dateFormat as string
    );

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="contribution_statement_${account.accountNumber}_${formatDate(new Date(), 'yyyy-MM-dd')}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Download statement error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
