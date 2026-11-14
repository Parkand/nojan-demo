'use client';

import { useState } from 'react';

const numeric = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const heading = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
});

const display = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const digits = new Intl.NumberFormat('fa-IR', {
  useGrouping: false,
});

const min = '2000-01-01';
const max = '2100-12-31';

function parse(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shift(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function parts(date: Date) {
  const values = numeric.formatToParts(date);

  return {
    day: Number(values.find(part => part.type === 'day')!.value),
    month: Number(values.find(part => part.type === 'month')!.value),
  };
}

function monthStart(date: Date) {
  return shift(date, 1 - parts(date).day);
}

type PersianDateInputProps = {
  date: string;
  name?: string;
  label?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
};

export function PersianDateInput({
  date,
  name = 'orderDate',
  label = 'تاریخ سفارش',
  disabled = false,
  onChange,
}: PersianDateInputProps) {
  const [value, setValue] = useState(date);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => monthStart(parse(date)));

  const next = monthStart(shift(anchor, 32));
  const previous = monthStart(shift(anchor, -1));
  const length = Math.round(
    (next.getTime() - anchor.getTime()) / 86400000,
  );
  const offset = (anchor.getUTCDay() + 1) % 7;

  return (
    <div className="field">
      <span>{label}</span>

      <input
        type="hidden"
        name={name}
        value={value}
        disabled={disabled}
      />

      <button
        type="button"
        className="btn"
        disabled={disabled}
        aria-label={`انتخاب ${label} به شمسی`}
        aria-expanded={open && !disabled}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          border: '1px solid #e5e7eb',
          minHeight: 52,
        }}
        onClick={() => {
          if (!open) {
            setAnchor(monthStart(parse(value)));
          }
          setOpen(!open);
        }}
      >
        <span>{display.format(parse(value))}</span>
        <span aria-hidden="true">▦</span>
      </button>

      {open && !disabled && (
        <div
          role="group"
          aria-label={`تقویم شمسی ${label}`}
          dir="rtl"
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 12,
            background: '#fff',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="btn"
              aria-label="ماه قبل"
              disabled={iso(shift(anchor, -1)) < min}
              onClick={() => setAnchor(previous)}
            >
              →
            </button>

            <strong aria-live="polite">
              {heading.format(anchor)}
            </strong>

            <button
              type="button"
              className="btn"
              aria-label="ماه بعد"
              disabled={iso(next) > max}
              onClick={() => setAnchor(next)}
            >
              ←
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 4,
              textAlign: 'center',
            }}
          >
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day, index) => (
              <span key={`week-${index}`} aria-hidden="true">
                {day}
              </span>
            ))}

            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}

            {Array.from({ length }, (_, index) => {
              const current = shift(anchor, index);
              const key = iso(current);
              const selected = key === value;

              return (
                <button
                  key={key}
                  type="button"
                  aria-label={display.format(current)}
                  aria-pressed={selected}
                  disabled={key < min || key > max}
                  style={{
                    minHeight: 36,
                    padding: 2,
                    borderRadius: 8,
                    border: '1px solid #eee',
                    background: selected ? '#be123c' : '#fff',
                    color: selected ? '#fff' : '#222',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setValue(key);
                    onChange?.(key);
                    setOpen(false);
                  }}
                >
                  {digits.format(index + 1)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn"
            style={{ marginTop: 8 }}
            onClick={() => setOpen(false)}
          >
            بستن تقویم
          </button>
        </div>
      )}

      <small>تاریخ و تقویم به شمسی است.</small>
    </div>
  );
}