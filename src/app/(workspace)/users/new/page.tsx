import { UserEditor } from '@/components/user-editor';
import { requireSuperAdmin } from '@/lib/auth';

export const metadata = { title: 'ثبت کاربر' };

export default async function Page() {
  await requireSuperAdmin();

  return <UserEditor />;
}