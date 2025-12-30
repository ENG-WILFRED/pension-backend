import PDFDocument from 'pdfkit';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

export async function generateTransactionPdf(transactions: any[], title = 'Transactions Report'): Promise<Buffer> {
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
  const buffer = await streamToBuffer(doc as any);
  return buffer;
}

export async function generateCustomerPdf(user: any, transactions: any[], title = 'Customer Report'): Promise<Buffer> {
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
  const buffer = await streamToBuffer(doc as any);
  return buffer;
}
