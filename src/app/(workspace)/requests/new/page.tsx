import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PersonnelRequestForm } from '@/components/personnel-request-form';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { personnelRecipientRoles } from '@/lib/personnel-request-permissions';

export const dynamic = 'force-dynamic';

export default async function NewPersonnelRequestPage() {
  const user = await requireUser();
  const roles = personnelRecipientRoles(user.role);

  if (roles.length === 0) {
    notFound();
  }

  const recipients = await db.user.findMany({
    where: {
      role: { in: roles },
      deletedAt: null,
      id: { not: user.id },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: [
      { name: 'asc' },
      { id: 'asc' },
    ],
  });

  const submissionKey = randomUUID();

  return (
    <section dir="rtl" style={{ maxWidth: 800 }}>
      <h1>ثبت درخواست پرسنلی</h1>

      <p>
        {user.role === 'USER'
          ? 'یک مدیر را انتخاب کنید. درخواست شما فقط برای همان مدیر ارسال می‌شود.'
          : 'یک مدیر ارشد را انتخاب کنید. درخواست شما فقط برای همان مدیر ارشد ارسال می‌شود.'}
      </p>

      <p>
        مدیران ارشد امکان مشاهدهٔ تمام درخواست‌ها و پاسخ‌ها را دارند.
        این دسترسی نظارتی، به‌تنهایی اجازهٔ پاسخ‌دادن نمی‌دهد.
      </p>

      <p>
        درخواست دسته‌بندی ندارد؛ موضوع و توضیحات لازم را در متن بنویسید.
        پیش از ثبت، متن و گیرنده را بررسی کنید.
      </p>

      <PersonnelRequestForm
        key={submissionKey}
        mode="create"
        submissionKey={submissionKey}
        recipients={recipients}
      />

      <p style={{ marginTop: 24 }}>
        <Link href="/requests" className="btn secondary">
          بازگشت به درخواست‌ها
        </Link>
      </p>
    </section>
  );
}