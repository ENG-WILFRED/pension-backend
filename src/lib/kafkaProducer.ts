import dotenv from 'dotenv';
dotenv.config();

export interface NotificationPayload {
  id: string;
  to: string;
  channel: 'email' | 'sms';
  template: string;
  data: Record<string, unknown>;
  timestamp: number;
}

let producer: any | null = null;
let producerInitializing = false;
let producerError: Error | null = null;

const KAFKA_CONNECT_TIMEOUT = 10000; // 10 seconds
const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false'; // Default to enabled

function buildProducerConfig(): Record<string, unknown> {
  const brokersEnv = process.env.KAFKA_BROKER || process.env.KAFKA_BROKERS || 'localhost:9092';
  const brokers = Array.isArray(brokersEnv) ? brokersEnv : String(brokersEnv).split(',');

  const base: Record<string, unknown> = {
    'metadata.broker.list': brokers.join(','),
    'client.id': process.env.KAFKA_CLIENT_ID || 'notification-service',
    'security.protocol': process.env.KAFKA_SECURITY_PROTOCOL || (process.env.KAFKA_SASL_USERNAME ? 'sasl_ssl' : 'plaintext'),
    'sasl.mechanisms': process.env.KAFKA_SASL_MECHANISM || process.env.KAFKA_SASL_MECHANISMS || 'SCRAM-SHA-256',
    'sasl.username': process.env.KAFKA_SASL_USERNAME,
    'sasl.password': process.env.KAFKA_SASL_PASSWORD,
    'ssl.ca.location': process.env.KAFKA_SSL_CA_LOCATION,
    'socket.timeout.ms': 10000,
    'connections.max.idle.ms': 30000,
    'session.timeout.ms': 30000,
    'dr_cb': true,
  };

  return base;
}

export async function createProducer(): Promise<any | null> {
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
    const Kafka = (await import('node-rdkafka')) as any;
    const conf = buildProducerConfig();
    console.log(`[KAFKA-PRODUCER] Connecting to broker: ${conf['metadata.broker.list']}`);
    producer = new Kafka.Producer(conf);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[KAFKA-PRODUCER] Connection timeout after 10s');
        producerInitializing = false;
        producerError = new Error('Kafka connection timeout');
        producer = null;
        reject(producerError);
      }, KAFKA_CONNECT_TIMEOUT);

      const onReady = () => {
        clearTimeout(timeout);
        producer?.removeListener('event.error', onError);
        console.log('[KAFKA-PRODUCER] ✓ Producer connected successfully');
        producerInitializing = false;
        producerError = null;
        resolve(producer);
      };

      const onError = (err: unknown) => {
        clearTimeout(timeout);
        console.error('[KAFKA-PRODUCER] Connection failed:', err instanceof Error ? err.message : err);
        producerInitializing = false;
        producerError = err instanceof Error ? err : new Error(String(err));
        producer = null;
        reject(producerError);
      };

      producer.on('ready', onReady);
      producer.on('event.error', onError);

      try {
        producer.connect();
      } catch (e) {
        clearTimeout(timeout);
        console.error('[KAFKA-PRODUCER] Connect threw error:', e);
        producerInitializing = false;
        producerError = e instanceof Error ? e : new Error(String(e));
        producer = null;
        reject(producerError);
      }
    });
  } catch (err) {
    producerInitializing = false;
    producerError = err instanceof Error ? err : new Error(String(err));
    console.error('[KAFKA-PRODUCER] Failed to create producer:', producerError.message);
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
    p.produce(
      topic,
      null,
      Buffer.from(JSON.stringify(payload)),
      payload.id,
      Date.now()
    );
    p.poll();
    console.log(`[KAFKA] Message produced: ${payload.id} → ${payload.template}`);
  } catch (err) {
    console.error('[KAFKA] Produce error:', err instanceof Error ? err.message : err);
    // Don't throw — gracefully degrade so notifications don't crash the app
  }
}

export async function closeProducer(): Promise<void> {
  if (!producer) return;
  return new Promise((resolve) => {
    try {
      producer.disconnect(() => {
        producer = null;
        resolve();
      });
    } catch (_e) {
      producer = null;
      resolve();
    }
  });
}

export default { createProducer, publishNotification, closeProducer };
