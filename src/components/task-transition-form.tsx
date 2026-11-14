'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { transitionTask } from '@/lib/task-transition-actions';
import type { TaskTransition } from '@/lib/task-permissions';

type Props = {
  taskId: number;
  version: number;
  allowedTransitions: TaskTransition[];
};

type FormState = {
  error?: string;
  success: boolean;
};

const labels: Record<TaskTransition, string> = {
  START: 'شروع انجام',
  SUBMIT: 'ارسال نتیجه برای بررسی',
  REQUEST_CHANGES: 'برگشت برای اصلاح',
  APPROVE: 'تأیید نهایی',
  CANCEL: 'لغو وظیفه',
};

const descriptions: Record<TaskTransition, string> = {
  START: 'وظیفه به وضعیت «در حال انجام» منتقل می‌شود.',
  SUBMIT: 'نتیجهٔ کار برای بررسی‌کننده ارسال می‌شود.',
  REQUEST_CHANGES: 'وظیفه همراه توضیحات شما برای اصلاح برگردانده می‌شود.',
  APPROVE: 'نتیجه تأیید می‌شود و وظیفه پایان می‌یابد.',
  CANCEL: 'وظیفه لغو می‌شود و از گردش انجام کار خارج خواهد شد.',
};

export function TaskTransitionForm({
  taskId,
  version,
  allowedTransitions,
}: Props) {
  const router = useRouter();
  const [transition, setTransition] = useState<TaskTransition>(
    allowedTransitions[0] ?? 'START',
  );
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const [state, formAction, pending] = useActionState<
    FormState,
    FormData
  >(
    async (_previous, formData) => {
      const selected = formData.get('transition');

      if (!allowedTransitions.some(value => value === selected)) {
        return {
          success: false,
          error: 'عملیات انتخاب‌شده در این فرم در دسترس نیست.',
        };
      }

      if (
        (selected === 'APPROVE' || selected === 'CANCEL') &&
        formData.get('confirmed') !== 'yes'
      ) {
        return {
          success: false,
          error: 'ابتدا انجام عملیات نهایی را تأیید کنید.',
        };
      }

      const result = await transitionTask({}, formData);

      return result.error
        ? { success: false, error: result.error }
        : { success: true };
    },
    { success: false },
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (allowedTransitions.length === 0) {
    return <p>در وضعیت فعلی، عملیاتی برای شما در دسترس نیست.</p>;
  }

  if (state.success) {
    return (
      <div role="status">
        <p>تغییر وضعیت ثبت شد؛ اطلاعات صفحه در حال تازه‌سازی است.</p>
        <button
          type="button"
          className="btn secondary"
          onClick={() => router.refresh()}
        >
          تازه‌سازی اطلاعات
        </button>
      </div>
    );
  }

  const requiresMessage =
    transition === 'SUBMIT' ||
    transition === 'REQUEST_CHANGES' ||
    transition === 'CANCEL';

  const requiresConfirmation =
    transition === 'APPROVE' || transition === 'CANCEL';

  return (
    <form action={formAction} aria-busy={pending}>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="version" value={version} />

      {state.error && (
        <div role="alert" style={{ marginBottom: 16 }}>
          <p style={{ color: '#b91c1c' }}>{state.error}</p>
          <button
            type="button"
            className="btn secondary"
            disabled={pending}
            onClick={() => router.refresh()}
          >
            دریافت آخرین وضعیت
          </button>
          <p>
            اگر نسخهٔ وظیفه تغییر کرده باشد، با دریافت آخرین
            وضعیت فرم بازنشانی می‌شود؛ پیش از آن متن توضیح را
            در صورت نیاز کپی کنید.
          </p>
        </div>
      )}

      <fieldset
        disabled={pending}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: 'grid',
          gap: 16,
        }}
      >
        <legend>ثبت عملیات وظیفه</legend>

        <label className="field">
          <span>عملیات</span>
          <select
            name="transition"
            value={transition}
            onChange={event => {
              const next = allowedTransitions.find(
                value => value === event.target.value,
              );

              if (next) {
                setTransition(next);
                setConfirmed(false);
              }
            }}
            aria-describedby="task-operation-description"
          >
            {allowedTransitions.map(value => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>

        <p id="task-operation-description">
          {descriptions[transition]}
        </p>

        <label className="field">
          <span>
            توضیحات {requiresMessage ? '(الزامی)' : '(اختیاری)'}
          </span>
          <textarea
            name="message"
            value={message}
            onChange={event => setMessage(event.target.value)}
            required={requiresMessage}
            minLength={requiresMessage ? 3 : undefined}
            maxLength={5000}
            rows={5}
            style={{ resize: 'vertical' }}
          />
          <small>
            {requiresMessage
              ? 'حداقل ۳ و حداکثر ۵٬۰۰۰ نویسه وارد کنید.'
              : 'حداکثر ۵٬۰۰۰ نویسه.'}
            {' '}این متن در تاریخچهٔ وظیفه ثبت می‌شود.
          </small>
        </label>

        {requiresConfirmation && (
          <label
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              name="confirmed"
              value="yes"
              checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)}
              required
            />
            <span>
              {transition === 'CANCEL'
                ? 'لغو این وظیفه را تأیید می‌کنم.'
                : 'تأیید نهایی نتیجهٔ این وظیفه را تأیید می‌کنم.'}
              {' '}بازگشایی وظیفه در گردش فعلی تعریف نشده است.
            </span>
          </label>
        )}

        <button
          type="submit"
          className="btn primary"
          disabled={
            pending ||
            (requiresConfirmation && !confirmed)
          }
        >
          {pending ? 'در حال ثبت…' : labels[transition]}
        </button>
      </fieldset>
    </form>
  );
}