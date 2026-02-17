export function generateAccountNumber(id: number | string, accountType: string): string {
  const year = new Date().getFullYear();
  const raw = String(id || '').replace(/\D/g, '');
  const padded = raw.padStart(9, '0');
  const prefix = accountType === 'MANDATORY' ? 'DF' : accountType;
  return `${prefix}-${year}-${padded}`;
}

export function formatAccountNumber(accountNumber: string): string {
  return accountNumber;
}
