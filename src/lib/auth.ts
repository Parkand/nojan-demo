import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db';
const COOKIE = 'nozhan_session';
function key() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32 || value.startsWith('REPLACE_')) throw new Error('SESSION_SECRET must be configured.');
  return new TextEncoder().encode(value);
}
export async function createSession(id: number, version: number) {
  const token = await new SignJWT({version}).setProtectedHeader({alg:'HS256'}).setSubject(String(id))
    .setIssuer('nozhan').setAudience('nozhan-web').setIssuedAt().setExpirationTime('8h').sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly:true, secure:process.env.COOKIE_SECURE === 'true', sameSite:'lax', path:'/', maxAge:8*3600 });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }
export const currentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let payload;
  try { ({payload} = await jwtVerify(token,key(), {algorithms:['HS256'],issuer:'nozhan',audience:'nozhan-web'})); }
  catch { return null; }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const user = await db.user.findFirst({where:{id,deletedAt:null},select:{id:true,name:true,username:true,role:true,sessionVersion:true}});
  return user && user.sessionVersion === payload.version ? user : null;
});
export async function requireUser() { const user = await currentUser(); if (!user) redirect('/login'); return user; }
export async function requireAdmin() { const user = await requireUser(); if (user.role !== 'ADMIN') redirect('/orders'); return user; }
