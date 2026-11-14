import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import input from '@inquirer/input';
import password from '@inquirer/password';

const db = new PrismaClient();
const ifMissing = process.argv.includes('--if-missing');

async function main() {
  const userCount = await db.user.count();

  if (userCount > 0) {
    const existingUser = userCount === 1
      ? await db.user.findFirst({
          select: {
            role: true,
            deletedAt: true,
          },
        })
      : null;

    if (
      ifMissing &&
      existingUser?.role === 'SUPER_ADMIN' &&
      existingUser.deletedAt === null
    ) {
      console.log('The initial super admin already exists; skipped.');
      return;
    }

    throw new Error(
      'The database already contains users. This bootstrap script requires an empty users table and will not delete or modify existing users.'
    );
  }

  const name = (
    await input({
      message: 'Super admin display name:',
    })
  ).trim();

  const username = (
    await input({
      message: 'Super admin username (English):',
    })
  ).trim().toLowerCase();

  const secret = await password({
    message: 'Super admin password (10-64 characters):',
    mask: '*',
  });

  const confirmation = await password({
    message: 'Repeat password:',
    mask: '*',
  });

  if (name.length < 2 || name.length > 100) {
    throw new Error('Display name must contain 2-100 characters.');
  }

  if (!/^[a-z0-9_.-]{3,64}$/.test(username)) {
    throw new Error(
      'Username must contain 3-64 lowercase English letters, digits, underscores, dots or hyphens.'
    );
  }

  if (
    secret.length < 10 ||
    secret.length > 64 ||
    Buffer.byteLength(secret, 'utf8') > 72
  ) {
    throw new Error(
      'Password must contain 10-64 characters and must not exceed 72 UTF-8 bytes.'
    );
  }

  if (secret !== confirmation) {
    throw new Error('Passwords do not match.');
  }

  const passwordHash = await bcrypt.hash(secret, 12);

  await db.$transaction(
    async (tx) => {
      if (await tx.user.count()) {
        throw new Error(
          'A user was created concurrently. No super admin was created by this operation.'
        );
      }

      const admin = await tx.user.create({
        data: {
          name,
          username,
          passwordHash,
          role: 'SUPER_ADMIN',
        },
      });

      await tx.user.update({
        where: {
          id: admin.id,
        },
        data: {
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    },
    {
      isolationLevel: 'Serializable',
    }
  );

  console.log('Super admin created successfully.');
}

main()
  .catch((error) => {
    if (
      error?.name === 'ExitPromptError' ||
      error?.name === 'AbortPromptError'
    ) {
      console.error('Super admin creation was cancelled.');
    } else if (error?.code === 'P2034') {
      console.error(
        'A concurrent database operation prevented creation. Check the users table before trying again.'
      );
    } else if (error?.code === 'P2002') {
      console.error('A user with this unique value already exists.');
    } else {
      console.error(
        'Super admin creation failed:',
        error instanceof Error ? error.message : 'Unknown error.'
      );
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });