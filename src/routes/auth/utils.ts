import axios from 'axios';

// Poll payment gateway /health until it returns { status: 'ok' } or timeout
export async function waitForPaymentGatewayHealth(baseUrl: string, timeoutMs = 60_000, intervalMs = 1000): Promise<boolean> {
  const start = Date.now();
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await axios.get(healthUrl, { timeout: 5000 });
      if (resp && resp.data && resp.data.status === 'ok') {
        return true;
      }
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export function computeAge(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}
