'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PersianDateInput } from '@/components/persian-date-input';
import { createTask } from '@/lib/task-actions';

type AssigneeOption = {
  id: number;
  name: string;
  roleLabel: string;
};

type TaskCreateFormProps = {
  assignees: AssigneeOption[];
  initialDate: string;
  reviewerName: string;
};

type FormState = {
  error?: string;
  success: boolean;
};

const initialState: FormState = {
  success: false,
};

const tehranFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tehran',
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function tehranWallTime(date: Date): number {
  const parts = tehranFormatter.formatToParts(date);

  function value(type: Intl.DateTimeFormatPartTypes): number {
    return Number(parts.find(part => part.type === type)?.value);
  }

  return Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
}

function deadlineToUtc(date: string, time: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < '2000-01-01' ||
    date > '2100-12-31' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error('تاریخ و ساعت مهلت را به‌درستی انتخاب کنید.');
  }

  const wallDate = new Date(`${date}T${time}:00.000Z`);

  if (
    !Number.isFinite(wallDate.getTime()) ||
    wallDate.toISOString() !== `${date}T${time}:00.000Z`
  ) {
    throw new Error('تاریخ مهلت معتبر نیست.');
  }

  const target = wallDate.getTime();
  let instant = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const difference = target - tehranWallTime(new Date(instant));

    if (difference === 0) {
      return new Date(instant).toISOString();
    }

    instant += difference;
  }

  if (tehranWallTime(new Date(instant)) !== target) {
    throw new Error('این ساعت در منطقهٔ زمانی تهران معتبر نیست.');
  }

  return new Date(instant).toISOString();
}

export function TaskCreateForm(props: TaskCreateFormProps) {
  const [generation, setGeneration] = useState(0);

  return (
    <TaskCreateFields
      key={generation}
      {...props}
      onCreateAnother={() => setGeneration(value => value + 1)}
    />
  );
}

function TaskCreateFields({
  assignees,
  initialDate,
  reviewerName,
  onCreateAnother,
}: TaskCreateFormProps & {
  onCreateAnother: () => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState(initialDate);
  const [deadlineTime, setDeadlineTime] = useState('17:00');

  const [state, formAction, pending] = useActionState<
    FormState,
    FormData
  >(
    async (_previousState, formData) => {
      let dueAt = '';

      if (formData.get('hasDeadline') === 'yes') {
        try {
          dueAt = deadlineToUtc(
            String(formData.get('deadlineDate') ?? ''),
            String(formData.get('deadlineTime') ?? ''),
          );
        } catch (error: unknown) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'تبدیل تاریخ مهلت انجام نشد.',
          };
        }
      }

      formData.set('dueAt', dueAt);
      formData.delete('hasDeadline');
      formData.delete('deadlineDate');
      formData.delete('deadlineTime');

      const result = await createTask({}, formData);

      if (result.error) {
        return {
          success: false,
          error: result.error,
        };
      }

      return { success: true };
    },
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <div>
        <p role="status">
          وظیفه با موفقیت ثبت شد و اعلان داخل برنامه برای مسئول آن
          ایجاد شد.
        </p>

        <button
          type="button"
          className="btn primary"
          onClick={onCreateAnother}
        >
          ایجاد وظیفهٔ دیگر
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} aria-busy={pending}>
      {state.error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {state.error}
        </p>
      )}

      <fieldset
        disabled={pending}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: 'grid',
          gap: 20,
        }}
      >
        <legend>اطلاعات وظیفه</legend>

        <label className="field">
          <span>عنوان وظیفه</span>
          <input
            name="title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            required
            minLength={3}
            maxLength={200}
          />
        </label>

        <label className="field">
          <span>شرح وظیفه</span>
          <textarea
            name="description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            required
            maxLength={10000}
            rows={7}
            style={{ resize: 'vertical' }}
          />
        </label>

        <label className="field">
          <span>مسئول انجام وظیفه</span>
          <select
            name="assigneeId"
            value={assigneeId}
            onChange={event => setAssigneeId(event.target.value)}
            required
          >
            <option value="" disabled>
              مسئول را انتخاب کنید
            </option>

            {assignees.map(assignee => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name} — {assignee.roleLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>اولویت</span>
          <select
            name="priority"
            value={priority}
            onChange={event => setPriority(event.target.value)}
          >
            <option value="LOW">کم</option>
            <option value="NORMAL">عادی</option>
            <option value="HIGH">زیاد</option>
            <option value="URGENT">فوری</option>
          </select>
        </label>

        <p>
          بررسی‌کنندهٔ اولیه: <strong>{reviewerName}</strong>
          <br />
          بررسی‌کننده همان ایجادکنندهٔ وظیفه است و از فرم قابل
          تغییر نیست.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            name="hasDeadline"
            value="yes"
            checked={hasDeadline}
            onChange={event => setHasDeadline(event.target.checked)}
          />
          تعیین مهلت انجام وظیفه
        </label>

        {hasDeadline && (
          <div style={{ display: 'grid', gap: 16 }}>
            <PersianDateInput
              date={deadlineDate}
              name="deadlineDate"
              label="تاریخ مهلت"
              disabled={pending}
              onChange={setDeadlineDate}
            />

            <label className="field">
              <span>ساعت مهلت به وقت تهران</span>
              <input
                type="time"
                name="deadlineTime"
                value={deadlineTime}
                onChange={event => setDeadlineTime(event.target.value)}
                required
                step={60}
                dir="ltr"
                aria-describedby="task-deadline-help"
              />
            </label>

            <small id="task-deadline-help">
              مهلت باید در آینده باشد. تاریخ انتخاب‌شده شمسی و
              ساعت به وقت تهران است؛ زمان به‌صورت UTC ذخیره می‌شود.
            </small>
          </div>
        )}

        <button
          type="submit"
          className="btn primary"
          disabled={pending || assignees.length === 0}
        >
          {pending ? 'در حال ثبت وظیفه…' : 'ثبت وظیفه'}
        </button>
      </fieldset>
    </form>
  );
}