// F:\Nexora Nojan\src\lib\auth.ts
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from './db';

const COOKIE = 'nozhan_session';

function key() {
  const value = process.env.SESSION_SECRET;

  if (
    !value ||
    value.length < 32 ||
    value.startsWith('REPLACE_')
  ) {
    throw new Error('SESSION_SECRET must be configured.');
  }

  return new TextEncoder().encode(value);
}

export async function createSession(id: number, version: number) {
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    throw new Error('Invalid session parameters.');
  }

  const token = await new SignJWT({ version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(id))
    .setIssuer('nozhan')
    .setAudience('nozhan-web')
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 3600
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export const currentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;

  if (!token) {
    return null;
  }

  let payload: JWTPayload;

  try {
    const verified = await jwtVerify(token, key(), {
      algorithms: ['HS256'],
      issuer: 'nozhan',
      audience: 'nozhan-web'
    });

    payload = verified.payload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== 'string' ||
    !/^[1-9]\d*$/.test(payload.sub)
  ) {
    return null;
  }

  const id = Number(payload.sub);
  const version = payload.version;

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    return null;
  }

  const user = await db.user.findFirst({
    where: {
      id,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      sessionVersion: true
    }
  });

  if (!user || user.sessionVersion !== version) {
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await currentUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (
    user.role !== 'ADMIN' &&
    user.role !== 'SUPER_ADMIN'
  ) {
    redirect('/orders');
  }

  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();

  if (user.role !== 'SUPER_ADMIN') {
    redirect('/orders');
  }

  return user;
}
