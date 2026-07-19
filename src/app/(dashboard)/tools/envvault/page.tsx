import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Shield, History } from 'lucide-react';

import { auth } from '@/lib/auth/full-config';
import { EnvVaultList } from '@/components/features/envvault/EnvVaultList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function EnvVaultPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">EnvVault</h1>
            <p className="text-sm text-muted-foreground">加密存储环境变量与敏感配置</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/tools/envvault/logs">
              <History className="size-4" />
              审计日志
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">安全说明</p>
              <p className="text-sm text-muted-foreground">
                所有 value 经 AES-256-GCM 加密存储，仅在你主动查看/复制时短暂解密。所有操作均记录在审计日志中。
              </p>
            </div>
          </CardContent>
        </Card>

        <EnvVaultList />
      </div>
    </div>
  );
}
