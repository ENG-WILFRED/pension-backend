import kafkaProducer from './kafkaProducer';

export async function notify(payload: Record<string, any>) {
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
