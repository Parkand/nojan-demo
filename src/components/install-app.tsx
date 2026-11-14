'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

type Device = 'ios' | 'android' | 'other';

const actionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 40,
  padding: '8px 14px',
  border: '1px solid #f0cbd1',
  borderRadius: 12,
  background: '#fff5f6',
  color: '#C82032',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
};

export default function InstallApp() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [device, setDevice] = useState<Device>('other');
  const [secure, setSecure] = useState(true);
  const [busy, setBusy] = useState(false);
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const ios =
      /iPad|iPhone|iPod/i.test(userAgent) ||
      (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);

    setDevice(
      ios ? 'ios' : /Android/i.test(userAgent) ? 'android' : 'other'
    );
    setSecure(window.isSecureContext);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
    const iosNavigator = navigator as Navigator & {
      standalone?: boolean;
    };

    function updateDisplayMode() {
      const isInstalled =
        standaloneQuery.matches ||
        fullscreenQuery.matches ||
        iosNavigator.standalone === true;

      setInstalled(isInstalled);

      if (isInstalled) {
        dialogRef.current?.close();
      }
    }

    function handleBeforeInstall(event: Event) {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
    }

    function handleInstalled() {
      promptRef.current = null;
      dialogRef.current?.close();
      setInstalled(true);
    }

    updateDisplayMode();
    setReady(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    standaloneQuery.addEventListener('change', updateDisplayMode);
    fullscreenQuery.addEventListener('change', updateDisplayMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      standaloneQuery.removeEventListener('change', updateDisplayMode);
      fullscreenQuery.removeEventListener('change', updateDisplayMode);
    };
  }, []);

  function showGuide() {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  async function install() {
    if (busy) return;

    const installPrompt = promptRef.current;

    if (!installPrompt) {
      showGuide();
      return;
    }

    setBusy(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
    } catch {
      showGuide();
    } finally {
      if (promptRef.current === installPrompt) {
        promptRef.current = null;
      }
      setBusy(false);
    }
  }

  if (!ready || installed) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: 16
      }}
    >
      <button
        type="button"
        onClick={install}
        disabled={busy}
        aria-haspopup="dialog"
        style={{
          ...actionStyle,
          opacity: busy ? 0.6 : 1,
          cursor: busy ? 'wait' : 'pointer'
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
        </svg>
        {busy
          ? 'در حال بازکردن نصب…'
          : device === 'ios'
            ? 'نصب نوژان روی آیفون / آیپد'
            : 'نصب نوژان'}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        dir="rtl"
        style={{
          width: 'min(440px, calc(100vw - 32px))',
          maxHeight: '85vh',
          boxSizing: 'border-box',
          margin: 'auto',
          padding: 20,
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          background: '#fff',
          color: '#1e293b',
          boxShadow: '0 16px 60px #0003',
          textAlign: 'right',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          overflowY: 'auto',
          fontFamily: 'inherit',
          fontSize: 14,
          lineHeight: 2
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <h2 id={titleId} style={{ margin: 0, fontSize: 18 }}>
            نصب نوژان
          </h2>

          <button
            type="button"
            aria-label="بستن راهنمای نصب"
            onClick={() => dialogRef.current?.close()}
            style={{
              ...actionStyle,
              padding: 0,
              width: 40,
              flexShrink: 0,
              fontSize: 22
            }}
          >
            ×
          </button>
        </div>

        {!secure ? (
          <p>
            برای نصب، نسخهٔ آنلاین نوژان را با آدرس HTTPS باز کنید.
            آدرس HTTP شبکهٔ محلی برای آزمایش نصب مناسب نیست.
          </p>
        ) : device === 'ios' ? (
          <ol style={{ paddingInlineStart: 22, margin: '16px 0' }}>
            <li>این سایت را در مرورگر Safari باز کنید.</li>
            <li>منوی اشتراک‌گذاری (Share) را باز کنید.</li>
            <li>
              گزینهٔ «افزودن به صفحهٔ اصلی» (Add to Home Screen) را بزنید.
              اگر دیده نمی‌شود، گزینه‌های منو را پایین‌تر بررسی کنید.
            </li>
            <li>
              اگر گزینهٔ «بازکردن به‌صورت برنامه» (Open as Web App) نمایش
              داده شد، آن را روشن نگه دارید.
            </li>
            <li>دکمهٔ «افزودن» (Add) را بزنید.</li>
          </ol>
        ) : device === 'android' ? (
          <>
            <ol style={{ paddingInlineStart: 22, margin: '16px 0' }}>
              <li>نسخهٔ آنلاین سایت را در Chrome باز کنید.</li>
              <li>منوی سه‌نقطهٔ مرورگر را بزنید.</li>
              <li>
                گزینهٔ «نصب برنامه» (Install app) یا «افزودن به صفحهٔ اصلی»
                (Add to Home screen) را انتخاب کنید.
              </li>
              <li>اگر گزینهٔ نصب نمایش داده شد، آن را تأیید کنید.</li>
            </ol>
            <p>
              اگر فقط ساخت میان‌بر پیشنهاد می‌شود، نصب کامل هنوز توسط مرورگر
              ارائه نشده است. مرورگر را به‌روز کنید و بررسی کنید برنامه از
              قبل نصب نشده باشد.
            </p>
          </>
        ) : (
          <p>
            سایت را در Chrome یا Edge باز کنید و گزینهٔ نصب برنامه را از
            نوار آدرس یا منوی مرورگر انتخاب کنید. نمایش این گزینه به
            پشتیبانی مرورگر و شرایط نصب بستگی دارد.
          </p>
        )}

        <p
          style={{
            marginBottom: 0,
            paddingTop: 12,
            borderTop: '1px solid #e5e7eb',
            color: '#64748b',
            fontSize: 13
          }}
        >
          نوژان پس از نصب هم برای ورود و مدیریت سفارش‌ها به اینترنت نیاز دارد.
        </p>
      </dialog>
    </div>
  );
}