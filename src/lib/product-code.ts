import { latinDigits } from './utils';

// Include soft-deleted products so their codes are never reused.
export function nextProductCode(products: { code: string }[]): string {
  let maximum = BigInt(0);
  for (const product of products) {
    const code = latinDigits(product.code.trim());
    if (/^\d+$/.test(code)) {
      const value = BigInt(code);
      if (value > maximum) maximum = value;
    }
  }
  const next = String(maximum + BigInt(1));
  if (next.length > 40) throw new Error('ظرفیت کد عددی کالا تکمیل شده است.');
  return next;
}
