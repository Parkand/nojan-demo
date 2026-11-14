'use client';

import { useEffect, useRef, useState } from 'react';
import { markPersonnelRequestNotificationsRead } from '@/lib/personnel-request-actions';

type Props = {
  requestId: number;
  notificationIds: number[];
};

export function PersonnelRequestNotificationsRead({
  requestId,
  notificationIds,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastAttempt = useRef<string | null>(null);

  const idsKey = notificationIds.join(',');

  useEffect(() => {
    if (!idsKey) {
      setError(null);
      return;
    }

    const attemptKey = `${requestId}:${idsKey}:${attempt}`;

    if (lastAttempt.current === attemptKey) {
      return;
    }

    lastAttempt.current = attemptKey;
    setError(null);

    async function markRead() {
      try {
        const result = await markPersonnelRequestNotificationsRead(
          requestId,
          idsKey.split(',').map(Number),
        );

        if (result.error) {
          setError(result.error);
        }
      } catch {
        setError(
          'خوانده‌شدن اعلان ثبت نشد. اتصال را بررسی و دوباره تلاش کنید.',
        );
      }
    }

    void markRead();
  }, [requestId, idsKey, attempt]);

  if (!error) {
    return null;
  }

  return (
    <aside
      role="alert"
      style={{
        marginBlock: 16,
        padding: 16,
        border: '1px solid var(--line)',
        borderRadius: 12,
      }}
    >
      <p>{error}</p>
      <button
        type="button"
        className="btn secondary"
        onClick={() => setAttempt((value) => value + 1)}
      >
        تلاش دوباره برای خواندن اعلان
      </button>
    </aside>
  );
}