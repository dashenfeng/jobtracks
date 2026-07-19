import { auth } from '@/lib/auth/full-config';
import { prisma } from '@/lib/db';
import { mergePreferences } from '@/lib/types/user';
import { SettingsForm } from '@/components/features/settings/SettingsForm';

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, name: true, preferences: true, createdAt: true },
      })
    : null;

  const preferences = mergePreferences(user?.preferences);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">设置</h1>
          <p className="text-sm text-muted-foreground">账号信息、偏好设置</p>
        </div>

        <SettingsForm
          email={user?.email ?? ''}
          name={user?.name ?? ''}
          preferences={preferences}
        />
      </div>
    </div>
  );
}
