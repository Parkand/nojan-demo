'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  createPersonnelRequest,
  markPersonnelRequestRead,
  replyToPersonnelRequest,
} from '@/lib/personnel-request-actions';

type FormState = {
  error?: string;
  success?: boolean;
};

type RecipientOption = {
  id: number;
  name: string;
};

type Props =
  | {
      mode: 'create';
      submissionKey: string;
      recipients: RecipientOption[];
    }
  | {
      mode: 'reply';
      submissionKey: string;
      requestId: number;
    }
  | {
      mode: 'read';
      requestId: number;
    };

export function PersonnelRequestForm(props: Props) {
  const [body, setBody] = useState('');
  const [recipientId, setRecipientId] = useState('');

  async function submit(
    _previous: FormState,
    formData: FormData,
  ): Promise<FormState> {
    try {
      const result =
        props.mode === 'create'
          ? await createPersonnelRequest({}, formData)
          : props.mode === 'reply'
            ? await replyToPersonnelRequest({}, formData)
            : await markPersonnelRequestRead({}, formData);

      return result.error
        ? { error: result.error }
        : { success: true };
    } catch {
      return {
        error:
          'ارتباط با سرور کامل نشد. دوباره تلاش کنید؛ کلید ارسال همین فرم حفظ شده است.',
      };
    }
  }

  const [state, action, pending] = useActionState<FormState, FormData>(
    submit,
    {},
  );

  const label =
    props.mode === 'create'
      ? 'ثبت درخواست'
      : props.mode === 'reply'
        ? 'ثبت پاسخ'
        : 'ثبت مشاهدهٔ درخواست';

  const inputId =
    props.mode === 'create'
      ? 'personnel-request-body'
      : `personnel-reply-body-${props.requestId}`;

  const noRecipients =
    props.mode === 'create' && props.recipients.length === 0;

  return (
    <form
      action={action}
      dir="rtl"
      aria-busy={pending}
      style={{ display: 'grid', gap: 12 }}
    >
      {props.mode !== 'create' && (
        <input type="hidden" name="requestId" value={props.requestId} />
      )}

      {props.mode !== 'read' && (
        <input
          type="hidden"
          name="submissionKey"
          value={props.submissionKey}
        />
      )}

      {state.error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {state.error}
        </p>
      )}

      {state.success ? (
        <div role="status" aria-live="polite">
          <p>
            {props.mode === 'create'
              ? 'درخواست شما برای گیرندهٔ انتخاب‌شده ثبت شد.'
              : props.mode === 'reply'
                ? 'پاسخ شما ثبت شد.'
                : 'مشاهدهٔ درخواست ثبت شد.'}
          </p>
          <Link href="/requests" className="btn secondary">
            بازگشت به فهرست درخواست‌ها
          </Link>
        </div>
      ) : (
        <>
          {props.mode === 'create' && (
            <>
              <label htmlFor="personnel-request-recipient">
                ارسال به
              </label>
              <select
                id="personnel-request-recipient"
                name="recipientId"
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                required
                disabled={pending || noRecipients}
                aria-describedby="personnel-request-recipient-help"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 12,
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  background: 'var(--white)',
                  color: 'inherit',
                  font: 'inherit',
                }}
              >
                <option value="" disabled>
                  گیرنده را انتخاب کنید
                </option>
                {props.recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name}
                  </option>
                ))}
              </select>

              <small id="personnel-request-recipient-help">
                درخواست و اعلان آن فقط برای فرد انتخاب‌شده ارسال
                می‌شود. مدیران ارشد می‌توانند تمام درخواست‌ها و پاسخ‌ها
                را مشاهده کنند؛ پاسخ‌دادن فقط برای گیرندهٔ مجاز امکان‌پذیر
                است.
              </small>

              {noRecipients && (
                <p role="status">
                  در حال حاضر گیرندهٔ فعالی برای انتخاب وجود ندارد.
                  ثبت درخواست تا زمان وجود گیرندهٔ مجاز امکان‌پذیر نیست.
                </p>
              )}
            </>
          )}

          {props.mode !== 'read' && (
            <>
              <label htmlFor={inputId}>
                {props.mode === 'create' ? 'متن درخواست' : 'متن پاسخ'}
              </label>
              <textarea
                id={inputId}
                name="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                minLength={3}
                maxLength={5000}
                rows={7}
                readOnly={pending}
                aria-describedby={`${inputId}-help`}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 12,
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  font: 'inherit',
                  lineHeight: 2,
                  resize: 'vertical',
                }}
              />
              <small id={`${inputId}-help`}>
                بین ۳ تا ۵٬۰۰۰ نویسه. پس از ثبت، متن قابل ویرایش نیست.
              </small>
            </>
          )}

          <button
            type="submit"
            className="btn primary"
            disabled={
              pending ||
              noRecipients ||
              (props.mode === 'create' && recipientId === '')
            }
          >
            {pending ? 'در حال ثبت…' : label}
          </button>
        </>
      )}
    </form>
  );
}