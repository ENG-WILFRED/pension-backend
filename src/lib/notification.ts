import kafkaProducer from './kafkaProducer';
import axios from 'axios';

const NOTIFICATION_SERVICE_BASE = process.env.NOTIFICATION_SERVICE_CONSUMER_URL || 'https://notification-service-consumer.onrender.com';

// Fire-and-forget ping to notification service /health. Do not await.
function pingNotificationService() {
  try {
    const url = `${NOTIFICATION_SERVICE_BASE.replace(/\/$/, '')}/health`;
    void axios.get(url, { timeout: 2000 }).catch((e) => {
      // Debug only — do not block notification flow
      console.debug('[notify] notification service health ping failed:', e?.message || e);
    });
  } catch (e) {
    // ignore
  }
}

export async function notify(payload: Record<string, any>) {
  // trigger health ping but do not wait for it
  pingNotificationService();
  const id = payload.id || `msg-${Date.now()}`;
  const kafkaPayload = {
    id,
    to: payload.to,
    channel: payload.channel || 'email',
    template: payload.template,
    data: payload.data || {},
    timestamp: Date.now(),
  };

  await kafkaProducer.publishNotification(kafkaPayload as any);
  return { id };
}

export async function sendOtpNotification(to: string, template: string, channel: string, otp: string, name?: string, expiryMinutes = 10) {
  const idempotencyKey = `otp-${to}-${Date.now()}`;
  // ping notification service health but don't wait
  pingNotificationService();

  const payload = {
    id: idempotencyKey,
    to,
    channel,
    template,
    data: { name, otp, expiryMinutes },
    timestamp: Date.now(),
  };

  await kafkaProducer.publishNotification(payload as any);
  return idempotencyKey;
}

export default { notify, sendOtpNotification };
