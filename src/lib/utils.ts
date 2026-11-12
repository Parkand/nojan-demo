export const fa = (value: number | string) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 }).format(Number(value));
export const dateFa = (value: Date | string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(value));
export const timeFa = (value: Date | string) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(value));
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export function searchValue(v: string | string[] | undefined) { return typeof v === 'string' ? v.trim().slice(0,100) : ''; }
export function pageNumber(v: string | string[] | undefined) { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 100000) : 1; }
export const PAGE_SIZE = 12;
export function latinDigits(value: string) { return value.replace(/[۰-۹]/g, c=>String(c.charCodeAt(0)-1776)).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)); }
