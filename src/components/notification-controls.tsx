'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notification-actions';
import type { ActionState } from '@/lib/types';

const initialState: ActionState = {};

export function ReadNotificationButton({
  notificationId,
}: {
  notificationId: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    markNotificationRead,
    initialState,
  );

  useEffect(() => {
    if (state !== initialState && !state.error) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action}>
      <input
        type="hidden"
        name="notificationId"
        value={notificationId}
      />

      <button
        type="submit"
        className="btn secondary"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? 'در حال ثبت…' : 'خواندم'}
      </button>

      {state.error && (
        <p role="alert" style={{ color: 'var(--red)' }}>
          {state.error}
        </p>
      )}
    </form>
  );
}

export function ReadAllNotificationsButton({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    markAllNotificationsRead,
    initialState,
  );

  useEffect(() => {
    if (state !== initialState && !state.error) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            'همهٔ اعلان‌های فعلی شما خوانده‌شده علامت‌گذاری شوند؟ این عملیات محدود به این صفحه نیست.',
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="btn secondary"
        disabled={disabled || pending}
        aria-busy={pending}
      >
        {pending ? 'در حال ثبت…' : 'خواندن همهٔ اعلان‌ها'}
      </button>

      {state.error && (
        <p role="alert" style={{ color: 'var(--red)' }}>
          {state.error}
        </p>
      )}

      {state !== initialState && !state.error && !pending && (
        <p role="status">
          عملیات خواندن اعلان‌ها انجام شد.
        </p>
      )}
    </form>
  );
}