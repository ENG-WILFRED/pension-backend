import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
});

client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

(async () => {
  if (!client.isOpen) {
    await client.connect();
    console.log('Redis connected');
  }
})();

export default client;
