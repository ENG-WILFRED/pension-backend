import PDFDocument from 'pdfkit';
// Use require to avoid moduleResolution/type issues for get-stream
const getStream: any = require('get-stream');

export async function generateTransactionPdf(transactions: any[], title = 'Transactions Report'): Promise<string> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();

  transactions.forEach((t, i) => {
    doc.fontSize(12).text(`${i + 1}. ${t.title || t.type} — ${t.amount} (${t.status})`);
    doc.fontSize(10).text(`   ID: ${t.id}`);
    if (t.description) doc.text(`   Description: ${t.description}`);
    if (t.createdAt) doc.text(`   Date: ${new Date(t.createdAt).toISOString()}`);
    doc.moveDown(0.5);
  });

  doc.end();
  // get-stream converts stream into a buffer
  const buffer = await (getStream as any).buffer(doc as any);
  return buffer.toString('base64');
}

export async function generateCustomerPdf(user: any, transactions: any[], title = 'Customer Report'): Promise<string> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`Customer: ${user.firstName || ''} ${user.lastName || ''}`);
  doc.text(`Email: ${user.email || ''}`);
  doc.text(`Phone: ${user.phone || ''}`);
  doc.moveDown();

  doc.fontSize(14).text('Transactions', { underline: true });
  doc.moveDown(0.5);

  transactions.forEach((t, i) => {
    doc.fontSize(12).text(`${i + 1}. ${t.title || t.type} — ${t.amount} (${t.status})`);
    doc.fontSize(10).text(`   ID: ${t.id}`);
    if (t.description) doc.text(`   Description: ${t.description}`);
    if (t.createdAt) doc.text(`   Date: ${new Date(t.createdAt).toISOString()}`);
    doc.moveDown(0.5);
  });

  doc.end();
  // @ts-ignore
  const buffer = await (getStream as any).buffer(doc as any);
  return buffer.toString('base64');
}
