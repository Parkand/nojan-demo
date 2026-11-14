import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth';
import { Back, Heading, Audit } from './ui';
import { ActionForm, PasswordInput } from './forms';

export async function UserEditor({
  id
}: {
  id?: number;
}) {
  const actor = await requireSuperAdmin();

  if (
    id !== undefined &&
    (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      id > 2147483647
    )
  ) {
    notFound();
  }

  const item = id !== undefined
    ? await db.user.findFirst({
      where: {
        id,
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { name: true }
        },
        updatedBy: {
          select: { name: true }
        }
      }
    })
    : null;

  if (id !== undefined && !item) {
    notFound();
  }

  const isSuperAdminAccount = item?.role === 'SUPER_ADMIN';

  const canDelete =
    item !== null &&
    item.id !== actor.id &&
    !isSuperAdminAccount;

  return (
    <>
      <Back href="/users" />

      <Heading
        title={item ? 'ویرایش کاربر' : 'ثبت کاربر جدید'}
        subtitle="مدیریت حساب‌ها و تعیین نقش کارمند یا مدیر فقط توسط مدیر ارشد انجام می‌شود."
      />

      <div className="form-panel">
        <ActionForm action="user.save" id={item?.id}>
          <div className="form-grid">
            <label className="field">
              نام و نام خانوادگی
              <input
                name="name"
                defaultValue={item?.name}
                required
                minLength={2}
                maxLength={100}
              />
            </label>

            <label className="field">
              نام کاربری
              <input
                name="username"
                defaultValue={item?.username}
                required
                minLength={3}
                maxLength={64}
                pattern="[a-zA-Z0-9_.\-]{3,64}"
                dir="ltr"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                readOnly={isSuperAdminAccount}
              />

              <small>
                {isSuperAdminAccount
                  ? 'نام کاربری مدیر ارشد از این فرم قابل تغییر نیست.'
                  : 'حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط'}
              </small>
            </label>

            {isSuperAdminAccount ? (
              <label className="field">
                نقش
                <input
                  type="text"
                  value="مدیر ارشد"
                  readOnly
                />
                <input
                  type="hidden"
                  name="role"
                  value="SUPER_ADMIN"
                />
                <small>
                  نقش مدیر ارشد از این فرم قابل تغییر نیست.
                </small>
              </label>
            ) : (
              <label className="field">
                نقش
                <select
                  name="role"
                  defaultValue={item?.role ?? 'USER'}
                  required
                >
                  <option value="USER">کارمند</option>
                  <option value="ADMIN">مدیر</option>
                </select>
                <small>
                  ایجاد مدیر ارشد از طریق این فرم مجاز نیست.
                </small>
              </label>
            )}

            <PasswordInput
              required={!item}
              editing={!!item}
            />
          </div>

          {item && (
            <p className="form-footnote">
              ذخیره تغییرات، نشست‌های قبلی این کاربر را باطل می‌کند
              و محدودیت ورود او را بازنشانی می‌کند.
              ویرایش حساب خودتان نیازمند ورود مجدد است.
            </p>
          )}
        </ActionForm>

        {item && <Audit item={item} />}
      </div>

      {canDelete && item && (
        <div className="delete-section">
          <p>
            حذف کاربر، دسترسی ورود او را قطع می‌کند؛
            سفارش‌های قبلی حفظ می‌شوند.
          </p>

          <ActionForm
            action="user.delete"
            id={item.id}
            label="حذف کاربر"
            danger
            confirm="حساب این کاربر به‌صورت نرم حذف شود؟"
          />
        </div>
      )}
    </>
  );
}