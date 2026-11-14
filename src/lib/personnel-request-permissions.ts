import { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type RequestActor = {
  id: number;
  role: Role;
};

/**
 * نقش‌های مجاز برای انتخاب گیرنده در درخواست جدید.
 *
 * این تابع، مجوز مشاهده یا پاسخ به درخواست‌های قبلی نیست.
 */
export function personnelRecipientRoles(senderRole: Role): Role[] {
  if (senderRole === Role.USER) {
    return [Role.ADMIN];
  }

  if (senderRole === Role.ADMIN) {
    return [Role.SUPER_ADMIN];
  }

  return [];
}

/**
 * بررسی سازگاری نقش برای گیرندگان ثبت‌شدهٔ درخواست.
 *
 * برای حفظ دسترسی گیرندگان درخواست‌های قبلی، مدیر ارشدی
 * که قبلاً گیرندهٔ درخواست کارمند بوده نیز مجاز باقی می‌ماند.
 *
 * این تابع به‌تنهایی مجوز پاسخ یا ثبت مشاهده نمی‌دهد.
 * فراخواننده باید عضویت کاربر در گیرندگان همان درخواست
 * را نیز بررسی کند.
 */
export function canReceivePersonnelRequest(
  senderRole: Role,
  recipientRole: Role,
): boolean {
  if (senderRole === Role.USER) {
    return (
      recipientRole === Role.ADMIN ||
      recipientRole === Role.SUPER_ADMIN
    );
  }

  if (senderRole === Role.ADMIN) {
    return recipientRole === Role.SUPER_ADMIN;
  }

  return false;
}

/**
 * محدودهٔ مشاهدهٔ درخواست‌ها.
 *
 * مدیر ارشد: همهٔ درخواست‌ها، مستقل از گیرنده بودن.
 * مدیر: درخواست‌های خودش و درخواست‌های کارمندی دریافتی.
 * کارمند: فقط درخواست‌های خودش.
 *
 * مجوز مشاهده، مجوز پاسخ نیست.
 */
export function personnelRequestReadWhere(
  actor: RequestActor,
): Prisma.PersonnelRequestWhereInput {
  if (actor.role === Role.SUPER_ADMIN) {
    return {};
  }

  if (actor.role === Role.ADMIN) {
    return {
      OR: [
        { senderId: actor.id },
        {
          senderRole: Role.USER,
          recipients: {
            some: { recipientId: actor.id },
          },
        },
      ],
    };
  }

  return { senderId: actor.id };
}