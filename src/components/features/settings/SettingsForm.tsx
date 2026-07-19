'use client';

import { useState } from 'react';
import { Loader2, Eye, EyeOff, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { UserPreferences } from '@/lib/types/user';

interface SettingsFormProps {
  email: string;
  name: string;
  preferences: UserPreferences;
}

export function SettingsForm({ email, name, preferences }: SettingsFormProps) {
  const [salaryMaskEnabled, setSalaryMaskEnabled] = useState(preferences.salaryMaskEnabled ?? true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSalaryMaskChange(checked: boolean) {
    setSalaryMaskEnabled(checked);
    setSaving(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaryMaskEnabled: checked }),
      });
    } catch {
      // 回滚
      setSalaryMaskEnabled(!checked);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: '/login', redirect: true });
  }

  return (
    <div className="space-y-6">
      {/* 账号信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号信息</CardTitle>
          <CardDescription>你的账号基础信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">邮箱</div>
              <div className="text-sm font-medium text-foreground">{email}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">昵称</div>
              <div className="text-sm font-medium text-foreground">{name || '-'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 显示偏好 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">显示偏好</CardTitle>
          <CardDescription>控制列表和详情页的敏感字段显示方式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="salary-mask" className="text-sm font-medium">
                  薪资字段掩码
                </Label>
                {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground">
                开启后，投递列表和详情页的薪资默认显示为掩码（如 <span className="tabular-nums">{'**-**K'}</span>），可临时切换为明文
              </p>
            </div>
            <Switch
              id="salary-mask"
              checked={salaryMaskEnabled}
              onCheckedChange={handleSalaryMaskChange}
            />
          </div>

          <Separator className="my-4" />

          {/* 预览 */}
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">效果预览</div>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                {salaryMaskEnabled ? (
                  <EyeOff size={14} className="text-muted-foreground" />
                ) : (
                  <Eye size={14} className="text-muted-foreground" />
                )}
                <span className="text-sm tabular-nums text-foreground">
                  {salaryMaskEnabled ? '**-**K·**薪' : '30-50K·16薪'}
                </span>
              </div>
              <Badge variant={salaryMaskEnabled ? 'secondary' : 'outline'}>
                {salaryMaskEnabled ? '掩码模式' : '明文模式'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账号操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号操作</CardTitle>
          <CardDescription>退出当前账号，需要重新登录后才能继续访问</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            退出登录
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
