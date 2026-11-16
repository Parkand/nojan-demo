// src/components/task-list-filters.tsx
'use client';

import Link from 'next/link';
import { useRef } from 'react';
import styles from './task-list.module.css';

type Scope = 'all' | 'assigned' | 'created' | 'review';

type Props = {
  scope: Scope;
  status: string;
  statusOptions: {
    value: string;
    label: string;
  }[];
};

function FilterIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 10a9 9 0 1 1 2.5 8.3" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function FilterFields({
  scope,
  status,
  statusOptions,
}: Props) {
  return (
    <>
      <label className={styles.filterField}>
        <span>ارتباط با من</span>

        <select name="scope" defaultValue={scope}>
          <option value="all">همهٔ وظایف قابل دسترسی</option>
          <option value="assigned">مسئولیت من</option>
          <option value="created">ایجادشده توسط من</option>
          <option value="review">بررسی من</option>
        </select>
      </label>

      <label className={styles.filterField}>
        <span>وضعیت</span>

        <select name="status" defaultValue={status}>
          <option value="">همهٔ وضعیت‌ها</option>

          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function TaskListFilters(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const activeCount =
    Number(props.scope !== 'all') +
    Number(props.status !== '');

  const hasFilters = activeCount > 0;

  const openFilters = () => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const closeFilters = () => {
    dialogRef.current?.close();
  };

  return (
    <div className={styles.filters}>
      <form
        action="/tasks"
        method="get"
        className={styles.desktopFilters}
        aria-label="فیلتر وظایف"
      >
        <FilterFields {...props} />

        <button
          type="submit"
          className={styles.primaryButton}
        >
          <FilterIcon />
          <span>نمایش نتایج</span>
        </button>

        {hasFilters && (
          <Link
            href="/tasks"
            className={styles.iconButton}
            aria-label="پاک‌کردن همهٔ فیلترها"
            title="پاک‌کردن فیلترها"
          >
            <ResetIcon />
          </Link>
        )}
      </form>

      <div className={styles.mobileFilters}>
        <button
          type="button"
          className={styles.filterTrigger}
          onClick={openFilters}
          aria-haspopup="dialog"
          aria-controls="task-filter-dialog"
        >
          <FilterIcon />
          <span>فیلترها</span>

          {hasFilters && (
            <span className={styles.filterCount}>
              <span className={styles.srOnly}>
                تعداد فیلترهای فعال:{' '}
              </span>
              {new Intl.NumberFormat('fa-IR').format(activeCount)}
            </span>
          )}
        </button>

        {hasFilters && (
          <Link
            href="/tasks"
            className={styles.iconButton}
            aria-label="پاک‌کردن همهٔ فیلترها"
            title="پاک‌کردن فیلترها"
          >
            <ResetIcon />
          </Link>
        )}
      </div>

      <dialog
        ref={dialogRef}
        id="task-filter-dialog"
        className={styles.filterDialog}
        aria-labelledby="task-filter-dialog-title"
        onClick={event => {
          if (event.target !== event.currentTarget) {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();

          const outside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;

          if (outside) {
            closeFilters();
          }
        }}
      >
        <div className={styles.dialogHandle} aria-hidden="true" />

        <div className={styles.dialogHeader}>
          <div>
            <h2 id="task-filter-dialog-title">فیلتر وظایف</h2>
            <p>نمایش فهرست را محدود کنید.</p>
          </div>

          <button
            type="button"
            className={styles.iconButton}
            onClick={closeFilters}
            aria-label="بستن فیلترها"
            autoFocus
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form
          action="/tasks"
          method="get"
          className={styles.dialogForm}
          aria-label="انتخاب فیلترهای وظایف"
        >
          <FilterFields {...props} />

          <div className={styles.dialogActions}>
            <button
              type="submit"
              className={styles.primaryButton}
            >
              نمایش نتایج
            </button>

            {hasFilters && (
              <Link
                href="/tasks"
                className={styles.secondaryButton}
              >
                پاک‌کردن فیلترها
              </Link>
            )}
          </div>
        </form>
      </dialog>
    </div>
  );
}
