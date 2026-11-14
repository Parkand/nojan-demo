'use client';

import { useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type OrderShareProps = {
  text: string;
  compact?: boolean;
};

type IconName = 'share' | 'copy' | 'text' | 'close' | 'select';

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="3" />
        <path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
      </>
    ),
    text: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    select: (
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M8 8h8M12 8v8M9 16h6" />
    )
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

const buttonStyle: CSSProperties = {
  width: 44,
  height: 44,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  borderRadius: 13,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#64748b',
  cursor: 'pointer'
};

export default function OrderShare({
  text,
  compact = false
}: OrderShareProps) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelId = useId();

  function showManualCopy(notice: string) {
    setMessage(notice);

    if (compact) {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) {
        dialog.showModal();
      }
    } else {
      setExpanded(true);
    }
  }

  function selectText() {
    const field = textRef.current;
    if (!field) return;

    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    setMessage('متن انتخاب شد؛ گزینهٔ کپی گوشی یا Ctrl+C را بزنید.');
  }

  async function copyText() {
    if (busy) return;
    setMessage('');

    if (!navigator.clipboard?.writeText) {
      showManualCopy('برای کپی دستی، دکمهٔ انتخاب متن را بزنید.');
      return;
    }

    setBusy(true);

    try {
      await navigator.clipboard.writeText(text);
      setMessage('متن سفارش کپی شد.');
    } catch {
      showManualCopy('کپی خودکار انجام نشد؛ متن را انتخاب و دستی کپی کنید.');
    } finally {
      setBusy(false);
    }
  }

  async function shareText() {
    if (busy) return;
    setMessage('');

    // اگر اشتراک مستقیم موجود نیست، متن را برای کپی نمایش بده.
    if (typeof navigator.share !== 'function') {
      showManualCopy('متن سفارش را کپی و در برنامهٔ دلخواه ارسال کنید.');
      return;
    }

    setBusy(true);

    try {
      // بدون بررسی اضافی، مستقیماً اشتراک دستگاه را اجرا کن.
      await navigator.share({ text });
    } catch (error: unknown) {
      // لغو توسط کاربر نباید پنجرهٔ متن را باز کند.
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        return;
      }

      showManualCopy(
        'اشتراک‌گذاری مستقیم انجام نشد؛ متن را کپی و ارسال کنید.'
      );
    } finally {
      setBusy(false);
    }
  }

  function actionButton(
    name: IconName,
    label: string,
    onClick: () => void,
    primary = false,
    disabled = false,
    small = false
  ) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        style={{
          ...buttonStyle,
          ...(primary
            ? {
                background: '#fff1f4',
                borderColor: '#ffe1e8',
                color: '#be123c'
              }
            : {}),
          ...(small
            ? {
                width: 32,
                height: 32,
                borderRadius: 9
              }
            : {}),
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'wait' : 'pointer'
        }}
      >
        <Icon name={name} size={small ? 15 : 19} />
      </button>
    );
  }

  const textField = (
    <textarea
      ref={textRef}
      aria-label="متن آمادهٔ اشتراک‌گذاری سفارش"
      value={text}
      readOnly
      dir="rtl"
      rows={12}
      spellCheck={false}
      style={{
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 180,
        padding: 12,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
        color: '#0f172a',
        fontFamily: 'inherit',
        fontSize: 14,
        lineHeight: 2,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        resize: 'vertical'
      }}
    />
  );

  const notice = (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        margin: message ? '10px 0 0' : 0,
        fontSize: 13,
        lineHeight: 1.9,
        color: '#475569',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere'
      }}
    >
      {message}
    </p>
  );

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', flexShrink: 0 }}>
        {actionButton(
          'share',
          'اشتراک‌گذاری سفارش',
          shareText,
          true,
          busy,
          true
        )}

        <dialog
          ref={dialogRef}
          aria-label="اشتراک‌گذاری متن سفارش"
          dir="rtl"
          style={{
            width: 'min(440px, calc(100vw - 32px))',
            maxHeight: '85vh',
            boxSizing: 'border-box',
            margin: 'auto',
            padding: 16,
            border: '1px solid #e5e7eb',
            borderRadius: 18,
            background: '#fff',
            color: '#0f172a',
            boxShadow: '0 16px 60px #0003',
            overflowY: 'auto',
            whiteSpace: 'normal'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12
            }}
          >
            <strong>متن سفارش</strong>
            {actionButton(
              'close',
              'بستن',
              () => dialogRef.current?.close()
            )}
          </div>

          {textField}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {actionButton('copy', 'کپی متن سفارش', copyText, true, busy)}
            {actionButton('select', 'انتخاب متن برای کپی دستی', selectText)}
          </div>

          {notice}
        </dialog>
      </div>
    );
  }

  return (
    <section
      aria-label="اشتراک‌گذاری متن سفارش"
      style={{
        margin: '16px 0',
        padding: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        minWidth: 0
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actionButton('share', 'اشتراک‌گذاری سفارش', shareText, true, busy)}
        {actionButton('copy', 'کپی متن سفارش', copyText, false, busy)}

        <button
          type="button"
          title={expanded ? 'بستن متن سفارش' : 'نمایش متن سفارش'}
          aria-label={expanded ? 'بستن متن سفارش' : 'نمایش متن سفارش'}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded(value => !value)}
          style={buttonStyle}
        >
          <Icon name={expanded ? 'close' : 'text'} />
        </button>
      </div>

      <p
        style={{
          margin: '8px 0 0',
          fontSize: 12,
          color: '#64748b',
          lineHeight: 1.9
        }}
      >
        قیمت‌ها مربوط به زمان ثبت سفارش‌اند. لیست بلند ممکن است در چند پیامک ارسال شود.
      </p>

      <div id={panelId} hidden={!expanded} style={{ marginTop: 12 }}>
        {textField}
        <div style={{ marginTop: 8 }}>
          {actionButton('select', 'انتخاب متن برای کپی دستی', selectText)}
        </div>
      </div>

      {notice}
    </section>
  );
}