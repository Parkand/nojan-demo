import Link from 'next/link';
import { Role } from '@prisma/client';
import { TaskCreateForm } from '@/components/task-create-form';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { canAssignTask } from '@/lib/task-permissions';

export const dynamic = 'force-dynamic';

function currentTehranDate(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());

  const year = parts.find(part => part.type === 'year')!.value;
  const month = parts.find(part => part.type === 'month')!.value;
  const day = parts.find(part => part.type === 'day')!.value;

  return `${year}-${month}-${day}`;
}

export default async function NewTaskPage() {
  const user = await requireAdmin();

  const allowedRoles: Role[] =
    user.role === Role.SUPER_ADMIN
      ? [Role.ADMIN, Role.USER]
      : [Role.USER];

  const candidates = await db.user.findMany({
    where: {
      deletedAt: null,
      id: { not: user.id },
      role: { in: allowedRoles },
    },
    select: {
      id: true,
      name: true,
      role: true,
      deletedAt: true,
    },
    orderBy: [
      { name: 'asc' },
      { id: 'asc' },
    ],
  });

  const actor = {
    id: user.id,
    role: user.role,
    deletedAt: null,
  };

  const assignees = candidates
    .filter(candidate => canAssignTask(actor, candidate))
    .map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      roleLabel:
        candidate.role === Role.ADMIN ? 'مدیر' : 'کارمند',
    }));

  return (
    <section dir="rtl" style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: 24 }}>
        <h1>ایجاد وظیفه</h1>
        <p>
          اطلاعات وظیفه و مسئول انجام آن را مشخص کنید.
          تاریخچه و اعلان مسئول هنگام ثبت ایجاد می‌شوند.
        </p>
      </header>

      {assignees.length === 0 ? (
        <div role="status">
          <h2>مسئول قابل انتخابی وجود ندارد</h2>
          <p>
            برای ایجاد وظیفه باید کاربر فعال با نقش مجاز وجود
            داشته باشد. مدیر فقط به کارمند و مدیر ارشد به مدیر
            یا کارمند می‌تواند وظیفه تخصیص دهد.
          </p>

          {user.role === Role.SUPER_ADMIN && (
            <Link href="/users" className="btn secondary">
              مدیریت کاربران
            </Link>
          )}
        </div>
      ) : (
        <TaskCreateForm
          assignees={assignees}
          initialDate={currentTehranDate()}
          reviewerName={user.name}
        />
      )}
    </section>
  );
}