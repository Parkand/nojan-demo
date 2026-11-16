// F:\Nexora Nojan\scripts\transfer-roles.mjs
import { PrismaClient } from '@prisma/client';

class UserFacingError extends Error {}

const targets = [
  { id: 1, username: 'nojan', role: 'SUPER_ADMIN' },
  { id: 2, username: 'hamoon', role: 'ADMIN' },
  { id: 3, username: 'saberi', role: 'USER' },
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.length === 1 && args[0] === '--apply';

  if (args.length > 0 && !apply) {
    throw new UserFacingError(
      'فقط اجرای بدون آرگومان یا با --apply مجاز است.',
    );
  }

  let url;

  try {
    url = new URL(process.env.DATABASE_URL ?? '');
  } catch {
    throw new UserFacingError(
      'DATABASE_URL بارگذاری نشده یا معتبر نیست.',
    );
  }

  if (
    url.protocol !== 'mysql:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    (url.port && url.port !== '3306') ||
    url.pathname !== '/nozhan'
  ) {
    throw new UserFacingError(
      'این ابزار فقط برای دیتابیس محلی nozhan روی پورت 3306 است.',
    );
  }

  const db = new PrismaClient();

  try {
    await db.$transaction(
      async (tx) => {
        const users = await tx.user.findMany({
          where: {
            id: { in: targets.map((target) => target.id) },
          },
          select: {
            id: true,
            username: true,
            role: true,
            deletedAt: true,
          },
        });

        for (const target of targets) {
          const user = users.find((item) => item.id === target.id);

          if (
            !user ||
            user.username !== target.username ||
            user.deletedAt !== null
          ) {
            throw new UserFacingError(
              `حساب حذف‌نشدهٔ ${target.username} با شناسهٔ ${target.id} پیدا نشد.`,
            );
          }
        }

        console.table(
          targets.map((target) => {
            const user = users.find((item) => item.id === target.id);

            return {
              id: target.id,
              username: target.username,
              currentRole: user.role,
              nextRole: target.role,
            };
          }),
        );

        if (!apply) {
          return;
        }

        for (const target of targets) {
          await tx.user.update({
            where: { id: target.id },
            data: {
              role: target.role,
              sessionVersion: { increment: 1 },
            },
          });
        }

        const finalUsers = await tx.user.findMany({
          where: {
            id: { in: targets.map((target) => target.id) },
          },
          select: {
            id: true,
            username: true,
            role: true,
            deletedAt: true,
          },
        });

        for (const target of targets) {
          const user = finalUsers.find(
            (item) => item.id === target.id,
          );

          if (
            !user ||
            user.username !== target.username ||
            user.role !== target.role ||
            user.deletedAt !== null
          ) {
            throw new UserFacingError(
              'کنترل نهایی ناموفق بود؛ تراکنش لغو می‌شود.',
            );
          }
        }
      },
      {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 30000,
      },
    );

    if (apply) {
      console.log('نقش‌های هر سه حساب با موفقیت ثبت شدند.');
      console.log('nojan: SUPER_ADMIN');
      console.log('hamoon: ADMIN');
      console.log('saberi: USER');
      console.log('نشست‌های قبلی هر سه حساب نامعتبر شدند.');
    } else {
      console.log('پیش‌نمایش پایان یافت؛ هیچ تغییری انجام نشد.');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  if (error instanceof UserFacingError) {
    console.error(error.message);
  } else {
    console.error(
      'خطای اتصال یا Prisma رخ داد؛ جزئیات اتصال برای حفظ محرمانگی چاپ نشد.',
    );
  }

  console.error(
    'عملیات موفق گزارش نشد. پیش از تکرار --apply، وضعیت را با پیش‌نمایش بررسی کنید.',
  );
  process.exitCode = 1;
});