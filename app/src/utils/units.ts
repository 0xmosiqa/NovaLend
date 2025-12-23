export function parseFixed(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Amount is required');

  const [wholeRaw, fracRaw = ''] = trimmed.split('.');
  const whole = wholeRaw || '0';

  if (!/^\d+$/.test(whole)) throw new Error('Invalid amount');
  if (!/^\d*$/.test(fracRaw)) throw new Error('Invalid amount');
  if (fracRaw.length > decimals) throw new Error(`Too many decimals (max ${decimals})`);

  const frac = fracRaw.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac || '0');
}

export function formatFixed(value: bigint, decimals: number): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;

  if (decimals === 0) return `${sign}${whole}`;

  const fracPadded = frac.toString().padStart(decimals, '0');
  const fracTrimmed = fracPadded.replace(/0+$/, '');
  return fracTrimmed ? `${sign}${whole}.${fracTrimmed}` : `${sign}${whole}`;
}

export function shortHex(value: string, left = 6, right = 4): string {
  if (!value.startsWith('0x') || value.length < 2 + left + right) return value;
  return `${value.slice(0, 2 + left)}…${value.slice(-right)}`;
}

