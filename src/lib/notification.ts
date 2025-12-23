import axios from 'axios';

const NOTIFY_URL = process.env.NOTIFY_URL || 'http://localhost:5371';

export async function notify(payload: Record<string, any>) {
  try {
    const res = await axios.post(`${NOTIFY_URL}/notify`, payload, { timeout: 5000 });
    return res.data;
  } catch (err) {
    // rethrow so callers can decide to fallback
    throw err;
  }
}

export async function sendOtpNotification(to: string, template: string, channel: string, otp: string, name?: string, expiryMinutes = 10) {
  const idempotencyKey = `otp-${to}-${Date.now()}`;

  const payload = {
    to,
    channel,
    template,
    data: { name, otp, expiryMinutes },
    idempotency_key: idempotencyKey,
  };

  try {
    const result = await notify(payload);
    return result?.id || idempotencyKey;
  } catch (err) {
    // If notification service unavailable, fallback to SMTP/email sender if configured{
    console.error('Notification service error:', err);
      // surface original error
      throw err;
    
  }
}

export default { notify, sendOtpNotification };
