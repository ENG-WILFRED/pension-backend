import nodemailer from 'nodemailer';
import { renderOtpEmail } from './templates/otp';

export function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) otp += digits[Math.floor(Math.random() * digits.length)];
  return otp;
}

export async function sendOtpEmail(to: string, otp: string, name?: string, expiryMinutes = 10) {
  const template = renderOtpEmail({ name, otp, expiryMinutes });

  const host = process.env.SMTP_HOST;
  if (!host) {
    // no SMTP configured — log the OTP for dev
    console.warn(`No SMTP configured — OTP for ${to}: ${otp}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  const from = process.env.SMTP_FROM || 'no-reply@example.com';

  await transporter.sendMail({
    from,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}
