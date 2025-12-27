import dotenv from 'dotenv';
import { Kafka, Producer } from 'kafkajs';

dotenv.config();

export interface NotificationPayload {
  id: string;
  to: string;
  channel: 'email' | 'sms';
  template: string;
  data: Record<string, unknown>;
  timestamp: number;
}

let producer: Producer | null = null;
let kafkaClient: Kafka | null = null;
let producerInitializing = false;
let producerError: Error | null = null;

const KAFKA_CONNECT_TIMEOUT = 10000; // 10 seconds
const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false'; // Default to enabled

function buildBrokersList(): string[] {
  const brokersEnv = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS;
  return Array.isArray(brokersEnv) ? brokersEnv : String(brokersEnv).split(',').map((b) => b.trim());
}

export async function createProducer(): Promise<Producer | null> {
  if (!KAFKA_ENABLED) {
    console.log('[KAFKA-PRODUCER] Kafka is disabled (KAFKA_ENABLED=false)');
    return null;
  }

  // If already cached and no error, return it
  if (producer) return producer;

  // If there was a previous error, return null (graceful degradation)
  if (producerError) {
    console.warn('[KAFKA-PRODUCER] Previous connection error, skipping retry:', producerError.message);
    return null;
  }

  // If currently initializing, wait for it
  if (producerInitializing) {
    let retries = 0;
    while (producerInitializing && retries < 50) {
      await new Promise((r) => setTimeout(r, 100));
      retries++;
    }
    return producer || null;
  }

  producerInitializing = true;

  try {
    const brokers = buildBrokersList();
    console.log(`[KAFKA-PRODUCER] Connecting to brokers: ${brokers.join(', ')}`);

    // Build Kafka client with SSL/SASL if configured
    const kafkaConfig: any = {
      clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
      brokers,
      connectTimeout: KAFKA_CONNECT_TIMEOUT,
      requestTimeout: KAFKA_CONNECT_TIMEOUT,
    };

    // Add SASL authentication if credentials provided
    if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
      kafkaConfig.sasl = {
        mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
      };
      kafkaConfig.ssl = process.env.KAFKA_SSL_ENABLED !== 'false';
    }

    kafkaClient = new Kafka(kafkaConfig);
    producer = kafkaClient.producer();

    await producer.connect();
    console.log('[KAFKA-PRODUCER] ✓ Producer connected successfully');
    producerInitializing = false;
    producerError = null;
    return producer;
  } catch (err) {
    producerInitializing = false;
    producerError = err instanceof Error ? err : new Error(String(err));
    console.error('[KAFKA-PRODUCER] Failed to create producer:', producerError.message);
    producer = null;
    kafkaClient = null;
    return null;
  }
}

export const initProducer = createProducer;

export async function publishNotification(payload: NotificationPayload): Promise<void> {
  if (!KAFKA_ENABLED) {
    console.log('[KAFKA] Notifications disabled, skipping');
    return;
  }

  try {
    const p = await createProducer();
    if (!p) {
      console.warn('[KAFKA] Producer not available, notification discarded:', payload.id);
      return;
    }

    const topic = process.env.KAFKA_TOPIC || 'notifications';
    await p.send({
      topic,
      messages: [
        {
          key: payload.id,
          value: JSON.stringify(payload),
          headers: {
            'content-type': 'application/json',
            'channel': payload.channel,
            'template': payload.template,
          },
        },
      ],
    });
    console.log(`[KAFKA] Message produced: ${payload.id} → ${payload.template} (${payload.channel})`);
  } catch (err) {
    console.error('[KAFKA] Produce error:', err instanceof Error ? err.message : err);
    // Don't throw — gracefully degrade so notifications don't crash the app
  }
}

export async function closeProducer(): Promise<void> {
  if (!producer) return;
  try {
    await producer.disconnect();
    producer = null;
    kafkaClient = null;
    console.log('[KAFKA-PRODUCER] Disconnected');
  } catch (err) {
    console.error('[KAFKA-PRODUCER] Disconnect error:', err);
    producer = null;
    kafkaClient = null;
  }
}

export default { createProducer, publishNotification, closeProducer };
