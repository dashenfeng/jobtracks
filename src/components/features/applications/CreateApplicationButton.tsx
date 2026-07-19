'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ApplicationFormDialog } from './ApplicationFormDialog';

/**
 * 顶部"新增投递"按钮（客户端组件）
 *
 * 新增成功后派发 window 事件，供 ApplicationList 监听刷新
 * （page.tsx 是 Server Component，无法直接传 onSuccess 回调）
 */
export function CreateApplicationButton() {
  return (
    <ApplicationFormDialog
      mode="create"
      trigger={
        <Button>
          <Plus className="size-4" />
          新增投递
        </Button>
      }
      onSuccess={() => {
        window.dispatchEvent(new CustomEvent('applications:refresh'));
      }}
    />
  );
}
