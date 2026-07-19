# 职迹 - 个人求职工作台 技术规格说明书

> **文档版本**：v3.4.0  
> **最后更新**：2026-07-14  
> **技术栈锁定版本**  
> **本次更新**：Changelog 模块完成（版本管理 + 变更分类 + 截图归档 + 按类型分组展示）

---

## 一、项目概述

### 1.1 产品定位
- **产品名称**：职迹
- **类型**：私有工具库（个人/团队使用）
- **核心功能**：求职投递管理 + 面试日程/面经沉淀 + 开发者工具集 + AI智能助手（Phase 2）
- **目标用户**：开发者本人及被邀请的协作者

### 1.2 MVP 范围（Phase 1）

| 优先级 | 模块 | 状态 | 说明 |
|--------|------|------|------|
| P0 | 项目框架 | ✅ 完成 | Next.js 16 + Prisma 7 + NextAuth v5 + shadcn/ui |
| P0 | 认证系统 | ✅ 完成 | 登录/注册/中间件守卫/JWT session/限流/密码强度 |
| P0 | 投递管理系统 | ✅ 完成 | CRUD + 筛选 + 搜索 + 薪资掩码 + 删除/刷新 |
| P0 | 数据分析 | ✅ 完成 | 趋势/状态分布/渠道分布/漏斗 + 4 指标卡（Recharts） |
| P0 | 面试日程 + 面经 + 错题本 | ✅ 完成 | Interview + Question CRUD + Upcoming + ReviewByTag |
| P1 | EnvVault | ✅ 完成 | AES-256-GCM 加密 + 二次认证 + ROTATE + 审计 + 限流 |
| P1 | JSON 工具 | ✅ 完成 | 格式化/压缩 + 命名转换（保护 key + 命中反馈）+ Diff + JSONPath |
| P2 | Snapshot Diff | ✅ 完成 | 快照 CRUD + 多选对比 + 行级 LCS / JSON 深度 diff 智能切换 |
| P2 | Changelog | ✅ 完成 | 版本管理 + 变更分类（NEW/FIX/IMPROVED/BREAKING）+ 截图归档 + 按类型分组展示 |
| P2 | AI Agent | ⏳ Phase 2 | 自然语言交互 |

### 1.3 技术栈（已锁定 - 2026年7月最新）

```
框架：     Next.js 16.2.9 (App Router + Turbopack + TypeScript)
React：    19.2.4 (Next.js 16 自带)
TS：       6.0.3
CSS：      Tailwind CSS v4 (@tailwindcss/postcss，零配置 CSS-first)
UI：       shadcn/ui (new-york 风格，zinc 基色，手动配置)
数据库：   PostgreSQL 18+ (本地 F:\Code\PostgreSQL)
ORM：      Prisma 7.8 + @prisma/adapter-pg (prisma.config.ts 新格式)
认证：     NextAuth v5 (next-auth@5.0.0-beta.31，JWT session，Credentials provider)
密码：     bcryptjs 3.x
加密：     Node.js crypto（AES-256-GCM + scrypt 密钥派生 + HMAC-SHA256 短期 token）
验证：     Zod 4.x
图表：     Recharts 3.9.1 + react-is 19.2.4
测试：     Vitest 4.1.9 + @vitest/coverage-v8
部署：     Vercel
AI：       Vercel AI SDK (Phase 2)
Node：     22.x LTS (用 nvm 管理)
包管理：   pnpm
```

---

## 二、项目初始化

### 2.1 环境要求
- Node.js ≥ 22.x LTS（用 nvm 管理）
- pnpm ≥ 10.x
- PostgreSQL ≥ 16（本地装在 `F:\Code\PostgreSQL`，数据目录 `F:\Code\PostgreSQL\data`）

### 2.2 依赖清单（与 package.json 完全对齐）

**dependencies（运行时依赖）**：

```bash
# 框架核心
pnpm add next@16.2.9 react@19.2.4 react-dom@19.2.4

# 认证
pnpm add next-auth@5.0.0-beta.31 bcryptjs
# 注：@auth/prisma-adapter 已移除，Credentials provider 不需要 adapter（会导致 session 创建失败）

# Prisma 7
pnpm add prisma@7.8 @prisma/client@7.8 @prisma/adapter-pg@7.8 pg

# shadcn/ui 依赖（手动配置，未走 CLI）
pnpm add class-variance-authority clsx tailwind-merge lucide-react tw-animate-css
pnpm add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
         @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator \
         @radix-ui/react-switch

# 表单 + 验证
pnpm add zod react-hook-form @hookform/resolvers

# 图表（数据分析模块，Recharts 3.x 支持 React 19）
pnpm add recharts react-is

# 工具库
pnpm add nanoid date-fns
```

**devDependencies（开发依赖）**：

```bash
pnpm add -D typescript@6.0.3 @types/node @types/react @types/react-dom @types/pg
pnpm add -D tailwindcss@4 @tailwindcss/postcss
pnpm add -D eslint eslint-config-next@16.2.9
pnpm add -D vitest@4.1.9 @vitest/coverage-v8
```

> ⚠️ **注意**：shadcn/ui CLI（`pnpm dlx shadcn@latest init`）因 zod v4 兼容问题不可用，改用手动配置 `components.json` + 直接复制组件源码的方式。

### 2.3 npm scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "db:seed": "node prisma/seed.mjs",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio",
  "db:generate": "prisma generate"
}
```

### 2.4 目录结构（实际）

```
jobtracks/
├── prisma/
│   ├── schema.prisma          # 数据模型定义（含 Interview/Question/EnvVault/AuditLog）
│   ├── migrations/            # 迁移文件
│   └── seed.mjs               # 种子脚本（ESM，手动加载 .env）
├── src/
│   ├── app/
│   │   ├── (auth)/            # 认证路由组（独立布局）
│   │   │   ├── layout.tsx     # 居中卡片布局
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # 仪表盘路由组（含 Sidebar + 动态 Header）
│   │   │   ├── layout.tsx
│   │   │   ├── applications/
│   │   │   │   ├── page.tsx              # 列表页
│   │   │   │   ├── [id]/page.tsx         # 详情页（嵌入 InterviewList）
│   │   │   │   ├── [id]/interviews/page.tsx  # 该投递的面试列表
│   │   │   │   └── analytics/page.tsx    # 数据分析页
│   │   │   ├── interviews/
│   │   │   │   ├── page.tsx              # 全部面试日程
│   │   │   │   └── [id]/page.tsx         # 面试详情 + 面经
│   │   │   ├── review/page.tsx           # 错题本（按 tag 聚合）
│   │   │   ├── tools/
│   │   │   │   ├── json/                 # ⏳ 占位
│   │   │   │   ├── envvault/             # ✅ EnvVault 主页
│   │   │   │   │   └── logs/page.tsx     # ✅ 审计日志页
│   │   │   │   ├── snapshots/            # ⏳ 占位
│   │   │   │   └── changelog/            # ⏳ 占位
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/route.ts     # NextAuth handlers
│   │   │   │   ├── register/route.ts          # 注册 API
│   │   │   │   └── verify-password/route.ts   # ✅ 二次认证入口
│   │   │   ├── applications/
│   │   │   │   ├── route.ts                   # GET 列表 / POST 新增
│   │   │   │   ├── [id]/route.ts              # GET / PATCH / DELETE
│   │   │   │   ├── [id]/status/route.ts       # 状态快速流转
│   │   │   │   ├── [id]/interviews/route.ts   # 该投递的面试列表
│   │   │   │   ├── stats/route.ts             # 统计
│   │   │   │   └── analytics/route.ts         # 数据分析
│   │   │   ├── interviews/
│   │   │   │   ├── route.ts                   # 全部面试 + upcoming
│   │   │   │   ├── [id]/route.ts              # 面试 CRUD
│   │   │   │   └── [id]/questions/route.ts    # 面经 CRUD
│   │   │   │   └── questions/[id]/route.ts    # 单题 PATCH/DELETE
│   │   │   ├── review/route.ts                # 错题本（performance=POOR）
│   │   │   ├── envvault/
│   │   │   │   ├── route.ts                   # GET 列表 / POST 新增
│   │   │   │   ├── [id]/route.ts              # PATCH / DELETE
│   │   │   │   ├── [id]/reveal/route.ts       # ✅ 查看明文（二次认证）
│   │   │   │   ├── [id]/copy/route.ts         # ✅ 复制明文（二次认证）
│   │   │   │   ├── import/route.ts            # ✅ 批量导入 + 审计
│   │   │   │   ├── export/route.ts            # ✅ 批量导出（POST + 二次认证 + 限流 + 审计）
│   │   │   │   └── rotate/route.ts            # ✅ ROTATE（重新加密 + 新 IV）
│   │   │   ├── audit-logs/route.ts            # ✅ 审计日志列表
│   │   │   └── user/preferences/route.ts      # 用户偏好
│   │   ├── layout.tsx                # 根布局（字体 + suppressHydrationWarning）
│   │   └── globals.css               # shadcn token + light/dark 双主题 + 图表色板
│   ├── components/
│   │   ├── ui/                # shadcn/ui 组件（button/card/badge/input/label/
│   │   │                      #   separator/table/dialog/select/textarea/switch/
│   │   │                      #   dropdown-menu/Placeholder）
│   │   ├── layout/            # Sidebar / Header / nav-items（共享导航数据）
│   │   │   ├── Sidebar.tsx           # 客户端组件，按 pathname 高亮当前项
│   │   │   ├── Header.tsx            # ✅ 客户端组件，动态面包屑（usePathname + 最长前缀匹配）
│   │   │   └── nav-items.ts          # 导航数据 + subPageLabels（用于面包屑子页识别）
│   │   └── features/
│   │       ├── applications/  # 投递管理功能组件
│   │       │   ├── ApplicationList.tsx      # 列表（筛选/分页/StatsCards/删除/刷新/监听事件）
│   │       │   ├── ApplicationFormDialog.tsx
│   │       │   ├── CreateApplicationButton.tsx  # 包装组件，成功后 dispatch 'applications:refresh' 事件
│   │       │   ├── StatusBadge.tsx          # 纯展示 Badge
│   │       │   ├── StatusSwitcher.tsx       # 可点击切状态（DropdownMenu + PATCH）
│   │       │   ├── StatsCards.tsx           # 4 个统计卡片
│   │       │   ├── AnalyticsClient.tsx      # 数据分析（4 图表 + 指标卡，Recharts）
│   │       │   ├── SalaryCell.tsx           # 列表薪资单元格（受控）
│   │       │   ├── SalaryToggle.tsx         # 详情薪资切换（自带 state）
│   │       │   └── DeleteApplicationButton.tsx
│   │       ├── interviews/    # ✅ 面试/面经/错题本组件
│   │       │   ├── InterviewList.tsx        # 面试列表（可嵌入详情页）
│   │       │   ├── InterviewSchedule.tsx    # 全部日程视图
│   │       │   ├── InterviewFormDialog.tsx  # 新增/编辑面试
│   │       │   ├── InterviewDetail.tsx      # 面试详情容器
│   │       │   ├── QuestionList.tsx         # 面经题目 CRUD
│   │       │   ├── QuestionFormDialog.tsx   # 新增/编辑题目
│   │       │   ├── UpcomingInterviews.tsx   # 首页提醒卡片
│   │       │   └── ReviewByTag.tsx          # 错题本（按 tag 聚合 + 筛选）
│   │       ├── envvault/      # ✅ EnvVault 组件
│   │       │   ├── EnvVaultList.tsx         # 主列表（集成二次认证 + ROTATE + 导出 + 删除确认 Dialog）
│   │       │   ├── EnvVaultFormDialog.tsx   # 新增/编辑
│   │       │   ├── EnvVaultImportDialog.tsx # 批量导入（文件/粘贴 + 预览）
│   │       │   ├── AuditLogList.tsx         # 审计日志列表（6 种动作 Badge 颜色）
│   │       │   └── useSensitiveAuth.tsx     # ✅ 二次认证 Hook（token 存 sessionStorage）
│   │       └── settings/
│   │           └── SettingsForm.tsx         # 设置表单（含薪资掩码 Switch）
│   ├── lib/
│   │   ├── db.ts              # Prisma Client (带 adapter)
│   │   ├── auth/
│   │   │   ├── full-config.ts # API Routes 用（含 Credentials + bcrypt）
│   │   │   ├── csrf.ts        # ✅ checkCsrf（Origin 头校验）
│   │   │   ├── rate-limit.ts  # ✅ rateLimit + getClientIp + _resetRateLimitForTest
│   │   │   └── verify-token.ts # ✅ signVerifyToken / verifyVerifyToken / checkVerifyToken（HMAC-SHA256）
│   │   ├── crypto/
│   │   │   └── aes.ts         # ✅ AES-256-GCM（encrypt/decrypt，scrypt 派生密钥，每条独立 IV）
│   │   ├── utils.ts           # cn + formatDate + formatDateTime + maskSalary
│   │   ├── constants/         # 状态/渠道/面试类型中文映射
│   │   ├── types/user.ts      # UserPreferences 类型 + mergePreferences
│   │   └── validations/       # Zod 验证 schema（application/interview/envvault）
│   ├── types/
│   │   └── next-auth.d.ts     # NextAuth 类型扩展（session.user.id）
│   ├── auth.config.ts         # Edge 安全配置（不含 prisma/bcrypt）
│   └── proxy.ts               # Next.js 16 中间件（原 middleware.ts）
├── components.json            # shadcn 配置（new-york, zinc, css-variables）
├── prisma.config.ts           # Prisma 7 配置（手动加载 .env）
├── vitest.config.ts           # Vitest 配置（environment: node, globals: true）
├── postcss.config.mjs
└── .env
```

---

## 三、Prisma 7 配置

### 3.1 prisma.config.ts（新格式，手动加载 .env）

```typescript
// prisma.config.ts
import { defineConfig, env } from 'prisma/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 手动加载 .env（Prisma 7 的 config 不会自动加载 .env）
try {
  const envPath = resolve(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

### 3.2 src/lib/db.ts（Prisma Client 单例）

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### 3.3 schema.prisma（数据模型）

完整 schema 见 [`prisma/schema.prisma`](./prisma/schema.prisma)。核心模型：

- **User** - 用户（email/password/name/role/preferences）- preferences 为 Json 字段，存储用户偏好（如薪资掩码开关）
- **Account / Session / VerificationToken** - NextAuth 适配表（虽然用 Credentials 不写 adapter，但 schema 保留）
- **Application** - 投递记录（核心业务表）
- **Interview** - 面试场次（关联 Application，一轮面试一条记录，含日程/形式/状态）
- **InterviewQuestion** - 面经题目（关联 Interview，结构化记录题目/回答/标签/表现）
- **Attachment** - 投递附件
- **EnvVault** - 环境变量保险箱（含 viewCount/lastViewedAt/lastCopiedAt 三个使用统计字段）
- **AuditLog** - 审计日志（6 种 AuditAction）
- **Snapshot** - 接口快照（schema 已建，模块未实现）
- **Changelog / Change** - 变更记录（schema 已建，模块未实现）

枚举：`Role`、`Channel`（BOSS/NIUKER/OFFICIAL/REFERRAL/OTHER）、`Status`（10 种状态）、`AuditAction`（VIEW/COPY/CREATE/UPDATE/DELETE/ROTATE）、`ChangeType`、`InterviewType`（VIDEO/PHONE/ONSITE）、`InterviewStatus`（SCHEDULED/COMPLETED/CANCELLED）、`QuestionDifficulty`（EASY/MEDIUM/HARD）、`QuestionPerformance`（GOOD/OKAY/POOR）

#### 索引（性能保障，所有外键查询字段均加 @@index）

- Application: `@@index([userId])`, `@@index([userId, status])`, `@@index([userId, updatedAt])`
- Interview: `@@index([applicationId])`, `@@index([userId, scheduledAt])`
- InterviewQuestion: `@@index([interviewId])`, `@@index([userId, performance])`（错题本查询）
- EnvVault: `@@index([userId])`（已有 @@unique([userId, key])）
- Snapshot: `@@index([userId])`, `@@index([userId, createdAt])`
- Changelog: `@@index([userId])`
- AuditLog: `@@index([userId, createdAt])`

### 3.4 数据库迁移与种子

```bash
# 生成 client
pnpm db:generate

# 创建/应用迁移
pnpm db:migrate --name <migration_name>

# 种子数据（测试用户 test@jobtracks.com / 123456）
pnpm db:seed

# 可视化管理
pnpm db:studio
```

---

## 四、NextAuth v5 配置（edge/full 拆分）

> ⚠️ **关键变更**：Credentials provider **不使用 PrismaAdapter**（adapter 是给 OAuth 用的，加 adapter 会导致 session-token cookie 不下发，登录失败）。Credentials 在 authorize 函数里手动查库 + bcrypt 校验。

### 4.1 src/auth.config.ts（Edge 安全配置）

```typescript
import type { NextAuthConfig } from 'next-auth';

// 只含 Edge 安全的配置（不含 prisma/bcrypt/db）
export const authConfig = {
  pages: { signIn: '/login' },
  providers: [],  // full-config 补充 Credentials
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isPublic = pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/api/auth');
      if (isPublic) return true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
```

### 4.2 src/lib/auth/full-config.ts（完整配置，API 用）

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authConfig } from '@/auth.config';
import { prisma } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {...}, password: {...} },
      async authorize(credentials) {
        // Zod 校验 → prisma 查用户 → bcrypt.compare → 返回 user
      },
    }),
  ],
});
```

### 4.3 src/proxy.ts（Next.js 16 中间件，原 middleware.ts）

```typescript
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  // 只守卫页面路径，API（非 auth）由 route 自己鉴权返回 401 JSON
  // /api/auth 需要 NextAuth 中间件处理（CSRF、session）
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/(?!auth)).*)'],
};
```

### 4.4 API Route Handler

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth/full-config';
export const { GET, POST } = handlers;
```

### 4.5 注册 API（独立实现）

`src/app/api/auth/register/route.ts` - POST 注册（Zod 校验含密码强度 + 限流 3次/小时/IP + 查重 + bcrypt 加密 + prisma.create）

### 4.6 类型扩展

`src/types/next-auth.d.ts` - 扩展 `Session.user.id` 和 `JWT.id`

---

## 五、Tailwind CSS v4 + shadcn/ui 配置

### 5.1 postcss.config.mjs

```javascript
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

### 5.2 shadcn/ui 安装方式（手动配置）

> ⚠️ **shadcn CLI 不可用**：`pnpm dlx shadcn@latest init` 在 zod v4 + Next.js 16 环境下会报 zod 兼容错误，因此采用手动配置方式。

**手动安装步骤**：

1. 安装底层依赖（Radix UI + 工具库）：

```bash
# shadcn 组件基于 Radix UI primitives
pnpm add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
         @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator \
         @radix-ui/react-switch

# shadcn 工具依赖
pnpm add class-variance-authority clsx tailwind-merge lucide-react tw-animate-css

# 图表库（数据分析模块用，Recharts 3.x 支持 React 19）
pnpm add recharts react-is
```

2. 创建 `components.json`（shadcn 配置文件，告诉 CLI 项目结构）：

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

3. 从 [shadcn/ui 官网](https://ui.shadcn.com/docs/components) 复制组件源码到 `src/components/ui/<component>.tsx`（每个组件是一个独立文件，不依赖外部包，方便自定义）。

4. 确保 `src/lib/utils.ts` 有 `cn` 函数（clsx + tailwind-merge）。

**配置要点**：
- `style: "new-york"` — 比 default 更紧凑，适合 dashboard 类应用
- `baseColor: "zinc"` — 中性灰，暗色模式下对比度好
- `cssVariables: true` — 用 CSS 变量做主题，支持 light/dark 切换
- 组件源码直接放项目里（不 npm 安装），可随意修改

### 5.3 globals.css（shadcn token + 双主题 + 图表色板）

使用 shadcn 标准 token：`--background` / `--foreground` / `--card` / `--border` / `--muted` / `--primary` / `--destructive` 等，通过 `@theme inline` 映射给 Tailwind。

- `:root` - 浅色主题
- `.dark` - 深色主题
- `html` 默认带 `dark` class
- 新增 `--chart-1` ~ `--chart-5` 图表色板 token（light/dark 各一套，供 Recharts 使用）

完整内容见 [`src/app/globals.css`](./src/app/globals.css)。

### 5.4 UI 组件层规范

- **布局层 + 特殊样式**：用 Tailwind 裸 class + shadcn token（`bg-card` / `border-border` / `text-foreground`）
- **组件层**（按钮/卡片/表格/弹窗/输入框/标签）：全走 shadcn/ui
- 颜色禁止硬编码（如 `text-gray-900`），保证 light/dark 切换不炸

### 5.5 shadcn 组件清单（已添加）

| 组件 | 文件 | 底层依赖 | 用途 |
|------|------|----------|------|
| `button` | `ui/button.tsx` | `@radix-ui/react-slot` + `class-variance-authority` | 按钮（variants: default/destructive/outline/secondary/ghost/link；sizes: default/sm/lg/icon） |
| `card` | `ui/card.tsx` | - | 卡片容器（Header/Title/Description/Content/Footer） |
| `badge` | `ui/badge.tsx` | `class-variance-authority` | 标签（variants: default/secondary/destructive/outline） |
| `input` | `ui/input.tsx` | - | 输入框 |
| `label` | `ui/label.tsx` | `@radix-ui/react-label` | 表单标签 |
| `separator` | `ui/separator.tsx` | `@radix-ui/react-separator` | 分隔线 |
| `table` | `ui/table.tsx` | - | 表格（Header/Body/Row/Head/Cell） |
| `dialog` | `ui/dialog.tsx` | `@radix-ui/react-dialog` | 弹窗（Trigger/Content/Header/Title/Description/Footer） |
| `select` | `ui/select.tsx` | `@radix-ui/react-select` | 下拉选择（Trigger/Content/Item/Value） |
| `textarea` | `ui/textarea.tsx` | - | 多行文本框 |
| `switch` | `ui/switch.tsx` | `@radix-ui/react-switch` | 开关（用于设置页偏好切换） |
| `dropdown-menu` | `ui/dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | 下拉菜单（Trigger/Content/Item/Label/Separator，用于状态快速流转） |
| `Placeholder` | `ui/Placeholder.tsx` | - | 占位组件（用于待开发模块：JSON/Snapshot/Changelog） |

### 5.6 添加新 shadcn 组件的流程

1. 从 shadcn/ui 官网找到目标组件文档
2. 复制组件源码到 `src/components/ui/<name>.tsx`
3. 如有新的 Radix 依赖，`pnpm add @radix-ui/react-<name>`
4. 确认 import 路径用 `@/lib/utils` 的 `cn` 函数
5. 在本 SPEC 的 5.5 清单里登记

---

## 六、环境变量

### 6.1 .env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobtracks"
AUTH_SECRET="replace-with-your-secret-key"
AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="replace-with-your-32-byte-hex-key"

# EnvVault 加密密钥（AES-256-GCM，至少 16 字符）
ENVAULT_ENCRYPTION_KEY="replace-with-your-own-random-key"
```

> ⚠️ `AUTH_SECRET` 同时被 NextAuth 和 verify-token（HMAC-SHA256 签名）复用，生产环境务必独立配置。

### 6.2 密钥生成

```bash
# AUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY / ENVAULT_ENCRYPTION_KEY (32字节十六进制)
openssl rand -hex 32
```

### 6.3 PostgreSQL 连接（本地）

- 数据目录：`F:\Code\PostgreSQL\data`
- 认证方式：`scram-sha-256`（pg_hba.conf）
- 用户：`postgres`，密码：`postgres`
- 数据库：`jobtracks`
- psql 连接命令：`psql -U postgres -h localhost`（必须显式指定 `-U postgres`，否则默认用 Windows 用户名 `fengfeng` 会认证失败）

---

## 七、API 设计

> 所有 API 用 `auth()` 鉴权，未登录返回 `{"error":"未登录"}` 401 JSON。查询均带 `userId` 隔离。所有 mutating API（POST/PATCH/DELETE）需校验 Origin 头防 CSRF（见第十三章）。

### 7.1 认证 API

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET/POST | /api/auth/[...nextauth] | ✅ | NextAuth handlers（CSRF、session、登录回调） |
| POST | /api/auth/register | ✅ | 注册（Zod + 密码强度 + 限流 + bcrypt + prisma） |
| POST | /api/auth/verify-password | ✅ | 二次认证入口：校验密码后签发 5 分钟 verify-token |

### 7.1.1 用户偏好 API（✅ 已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/user/preferences | 获取当前用户偏好（含默认值 merge） |
| PATCH | /api/user/preferences | 更新偏好（merge 模式，只传需要改的字段） |

当前支持的偏好字段：`salaryMaskEnabled: boolean`（薪资是否默认掩码，默认 true）

### 7.2 投递管理 API（✅ 已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/applications | 列表（分页 + status/channel 筛选 + keyword 搜索） |
| POST | /api/applications | 新增 |
| GET | /api/applications/[id] | 详情（含 attachments + interviews + questions） |
| PATCH | /api/applications/[id] | 更新 |
| DELETE | /api/applications/[id] | 删除 |
| GET | /api/applications/stats | 统计（各状态计数 + summary 汇总，用于 StatsCards） |
| PATCH | /api/applications/[id]/status | 状态快速流转（仅更新 status 字段） |
| GET | /api/applications/analytics | 数据分析（趋势/状态分布/渠道分布/漏斗/指标，一次 findMany + JS 聚合） |

### 7.2.1 面试日程 + 面经 API（✅ 已实现）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/applications/[id]/interviews | 某投递的面试列表 |
| POST | /api/applications/[id]/interviews | 新增面试场次 |
| GET | /api/interviews | 全部面试列表（支持 status 筛选 + 时间范围 + upcoming 标记） |
| GET | /api/interviews/[id] | 面试详情（含 questions） |
| PATCH | /api/interviews/[id] | 更新面试 |
| DELETE | /api/interviews/[id] | 删除面试 |
| GET | /api/interviews/[id]/questions | 面经题目列表 |
| POST | /api/interviews/[id]/questions | 新增面经题目 |
| PATCH | /api/interviews/questions/[id] | 更新题目 |
| DELETE | /api/interviews/questions/[id] | 删除题目 |
| GET | /api/review | 错题本（performance=POOR，按 tag 聚合） |

### 7.3 EnvVault API（✅ 已实现，含二次认证 + 限流 + 审计）

| 方法 | 路径 | 二次认证 | 限流 | 审计 |
|------|------|----------|------|------|
| GET | /api/envvault | 否 | - | - |
| POST | /api/envvault | 否 | - | CREATE |
| PATCH | /api/envvault/[id] | 否 | - | UPDATE（含 key） |
| DELETE | /api/envvault/[id] | 否 | - | DELETE（含 key） |
| POST | /api/envvault/[id]/reveal | ✅ | 30次/分钟 | VIEW（含 key） |
| POST | /api/envvault/[id]/copy | ✅ | 30次/分钟 | COPY（含 key） |
| POST | /api/envvault/import | 否 | - | CREATE × N（source: import） |
| POST | /api/envvault/export | ✅ | 5次/小时 | COPY × N（source: export） |
| POST | /api/envvault/rotate | ✅ | 3次/小时 | ROTATE（含 rotated/failed/total） |
| GET | /api/audit-logs | 否 | - | - |

> **二次认证流程**：客户端调用敏感 API 前，先 POST /api/auth/verify-password（带密码）拿到 token，然后所有敏感请求带 `X-Verify-Token` 头。token 5 分钟有效，存 sessionStorage。详见第十五章。

### 7.4 Snapshot API（✅ 已实现，含审计）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/snapshots | 列表（支持 ?q=&project=&contentType=&isBaseline= 筛选） |
| POST | /api/snapshots | 创建（含 contentLength 自动计算 + 审计） |
| GET | /api/snapshots/[id] | 详情（返回完整 content） |
| PATCH | /api/snapshots/[id] | 更新（content 留空表示不修改） |
| DELETE | /api/snapshots/[id] | 删除（含审计） |
| POST | /api/snapshots/diff | 对比（返回两个快照的 content，前端做 diff） |

### 7.5 Changelog API（✅ 已实现，含审计）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/changelogs | 列表（支持 ?q=&type= 筛选，按 releasedAt 倒序，不返回 changes 详情，只返回 _count） |
| POST | /api/changelogs | 创建（含 changes[] 批量创建 + 版本号唯一性校验 + 审计 CREATE） |
| GET | /api/changelogs/[id] | 详情（含 changes 列表） |
| PATCH | /api/changelogs/[id] | 更新（事务：基础字段更新 + changes 整体替换 deleteMany+createMany + 审计 UPDATE） |
| DELETE | /api/changelogs/[id] | 删除（级联删除 changes + 审计 DELETE） |

---

## 八、页面结构

```
/                           # 首页（重定向到 /applications）
/login                      # 登录 ✅
/register                   # 注册 ✅
/applications               # 投递管理列表 ✅
/applications/[id]          # 投递详情 ✅（嵌入 InterviewList，可就地加面试）
/applications/[id]/interviews  # 该投递的面试+面经列表 ✅
/applications/analytics     # 数据分析 ✅（趋势/状态/渠道/漏斗 + 指标卡）
/interviews                 # 全部面试日程 ✅
/interviews/[id]            # 面试详情 + 面经记录 ✅
/review                     # 错题本/复盘 ✅（按 tag 聚合）
/tools/json                 # JSON 工具 ✅（格式化/命名转换/Diff/JSONPath）
/tools/envvault             # EnvVault ✅
/tools/envvault/logs        # 审计日志 ✅
/tools/snapshots            # 快照对比 ✅
/tools/changelog            # Changelog ✅（列表）
/tools/changelog/[id]       # Changelog 详情 ✅（按类型分组展示 + 截图归档 + 编辑/删除）
/settings                   # 设置 ✅（账号信息 + 薪资掩码偏好 + 退出登录）
```

---

## 九、投递管理模块（P0）实现说明

### 9.1 状态机

10 种状态（`Status` 枚举）：

```
PENDING(待投递) → APPLIED(已投递) → WRITTEN(笔试)
  → INTERVIEW_1(一面) → INTERVIEW_2(二面) → INTERVIEW_3(三面)
  → HR(HR面) → OFFER(录用)

任意阶段 → REJECTED(拒绝) / ABANDONED(放弃)
```

每个状态有中文标签 + Badge 颜色 + 圆点颜色，定义在 [`src/lib/constants/applications.ts`](./src/lib/constants/applications.ts)。

### 9.2 渠道

`BOSS`(BOSS直聘) / `NIUKER`(牛客) / `OFFICIAL`(官网) / `REFERRAL`(内推) / `OTHER`(其他)

### 9.3 功能组件

| 组件 | 说明 |
|------|------|
| `ApplicationList` | 列表（搜索防抖 + 状态/渠道筛选 + Table + 分页 + 空状态 + 删除按钮 + 刷新按钮 + 监听 'applications:refresh' 事件） |
| `ApplicationFormDialog` | 新增/编辑表单 Dialog（复用，mode prop 区分） |
| `CreateApplicationButton` | 包装组件：Server Component 无法传 onSuccess 回调，故用 client 包装，成功后 `window.dispatchEvent(new CustomEvent('applications:refresh'))` |
| `StatusBadge` | 状态标签（圆点 + 文字） |
| `StatusSwitcher` | 可点击切状态（DropdownMenu + PATCH） |
| `StatsCards` | 4 个统计卡片（列表页顶部） |
| `AnalyticsClient` | 数据分析（4 图表 + 指标卡，Recharts） |
| `SalaryCell` / `SalaryToggle` | 薪资字段掩码控制 |
| `DeleteApplicationButton` | 删除确认 Dialog |

### 9.4 验证 schema

`src/lib/validations/application.ts`：
- `applicationSchema` - 表单验证（公司名/职位必填，URL 格式，长度限制）
- `applicationQuerySchema` - 查询参数验证（分页 + 枚举筛选）

### 9.5 薪资字段掩码（敏感字段控制）

**方案**：用户设置持久化（存 User.preferences Json 字段）+ 默认掩码

**数据流**：
1. 用户在 settings 页切换"薪资字段掩码"开关 → PATCH /api/user/preferences
2. 列表页（server component）读取用户 preferences → 传 `salaryMaskByDefault` 给 ApplicationList
3. ApplicationList 表头有眼睛图标，可临时切换显示/隐藏（不影响全局设置）
4. 详情页用 SalaryToggle 组件，独立的眼睛图标切换

**掩码规则**：数字替换为 `*`，保留单位和分隔符（如 `30-50K·16薪` → `**-**K·**薪`）

---

## 十、面试日程 + 面经沉淀 + 错题本（P0 深化，核心差异化，✅ 已完成）

> **设计理念**：投递管理 + CRUD 只是"流水账"，真正的价值在于「投递 → 面试日程 → 面经记录 → 错题复盘」闭环。这是"职迹"区别于 Excel 的核心。

### 10.1 数据模型

详见 §3.3 schema.prisma。核心模型：
- **Interview** - 面试场次（round/type/scheduledAt/durationMin/location/interviewer/status/overallNotes）
- **InterviewQuestion** - 面经题目（question/myAnswer/referenceAnswer/tags/difficulty/performance）

枚举：`InterviewType`(VIDEO/PHONE/ONSITE)、`InterviewStatus`(SCHEDULED/COMPLETED/CANCELLED)、`QuestionDifficulty`(EASY/MEDIUM/HARD)、`QuestionPerformance`(GOOD/OKAY/POOR)

### 10.2 页面与组件（✅ 全部实现）

| 路径 | 类型 | 说明 |
|------|------|------|
| `/applications/[id]/interviews` | 列表 | 某投递的所有面试场次（按 round 排序），每场可展开看面经 |
| `/applications/[id]` | 详情 | 直接嵌入 InterviewList，可就地新增面试场次（无需跳转） |
| `/interviews` | 日程 | 全部面试日程，按时间倒序，支持 status 筛选 |
| `/interviews/[id]` | 详情 | 面试信息 + 面经题目列表（可增删改） |
| `/review` | 复盘 | 错题本：performance=POOR 的题目，按 tag 聚合，支持按标签筛选 |

#### 组件清单（`src/components/features/interviews/`，✅ 全部实现）

- `InterviewList.tsx` — 面试列表（可嵌入投递详情页）
- `InterviewSchedule.tsx` — 全部日程视图
- `InterviewFormDialog.tsx` — 新增/编辑面试场次
- `InterviewDetail.tsx` — 面试详情容器
- `QuestionList.tsx` — 面经题目列表（可增删改）
- `QuestionFormDialog.tsx` — 新增/编辑面经题目
- `UpcomingInterviews.tsx` — 首页提醒卡片（未来 7 天）
- `ReviewByTag.tsx` — 错题本（按 tag 聚合 + 筛选）

### 10.3 中文映射常量

[`src/lib/constants/interviews.ts`](./src/lib/constants/interviews.ts) - 面试类型/状态/难度/表现的中文标签 + Badge 颜色

### 10.4 验证 schema

[`src/lib/validations/interview.ts`](./src/lib/validations/interview.ts) - 面试和题目的 Zod schema

---

## 十一、EnvVault 模块（✅ 已完成）

> **设计理念**：环境变量保险箱，AES-256-GCM 加密存储，所有敏感操作需二次认证，所有操作审计留痕。

### 11.1 加密方案

[`src/lib/crypto/aes.ts`](./src/lib/crypto/aes.ts)：
- 算法：AES-256-GCM
- 密钥派生：scrypt（从 ENVAULT_ENCRYPTION_KEY 派生 32 字节密钥）
- IV：每条独立随机 12 字节
- 密文格式：`base64(iv).base64(ciphertext).base64(authTag)`
- 解密失败返回原文（兼容旧数据迁移）

### 11.2 数据模型字段

EnvVault 表除 key/value/tags/notes 外，含三个使用统计字段：
- `viewCount Int @default(0)` - 累计查看次数
- `lastViewedAt DateTime?` - 最后查看时间
- `lastCopiedAt DateTime?` - 最后复制时间

API reveal/copy 时自动更新这些字段，列表 UI 在表格中展示。

### 11.3 ROTATE 功能

`POST /api/envvault/rotate`：
- 二次认证 + 限流（3次/小时）
- 解密所有 value → 重新 encrypt（生成新 IV）→ 逐条 update
- 审计日志记 ROTATE，metadata 含 `{rotated, failed, total}`
- 用于密钥轮换场景（如怀疑密钥泄露）

### 11.4 批量导入/导出

- **导入** `POST /api/envvault/import`：解析 .env 文本（支持引号、注释、空行），跳过已存在 key，批量 createMany 后查 id 写 CREATE 审计日志
- **导出** `POST /api/envvault/export`：批量解密所有 value，生成 .env 文本，Content-Disposition 触发下载。每条解密记 COPY 审计日志（source: export）

> ⚠️ export 从 GET 改为 POST，因为需要带 `X-Verify-Token` 自定义头，浏览器直接打开 URL 无法带头。

### 11.5 审计日志（6 种动作）

`AuditAction` 枚举：VIEW / COPY / CREATE / UPDATE / DELETE / ROTATE

| 触发位置 | 动作 | metadata |
|----------|------|----------|
| reveal API | VIEW | `{key}` |
| copy API | COPY | `{key}` |
| create API | CREATE | `{key}` |
| update API | UPDATE | `{key}` |
| delete API | DELETE | `{key}` |
| import API | CREATE × N | `{key, source: 'import'}` |
| export API | COPY × N | `{key, source: 'export'}` |
| rotate API | ROTATE | `{rotated, failed, total}` |

审计日志页 `/tools/envvault/logs` 用 AuditLogList 组件展示，列从"目标 ID"改为"键名"（从 metadata.key 提取），6 种动作 Badge 颜色映射。

---

## 十二、敏感操作二次认证（✅ 已完成）

### 12.1 Token 设计

[`src/lib/auth/verify-token.ts`](./src/lib/auth/verify-token.ts)：
- 格式：`base64url(payload).base64url(signature)`
- payload：`{userId, exp}`（exp 为秒级 Unix 时间戳）
- 签名：HMAC-SHA256(payloadB64, AUTH_SECRET)
- TTL：5 分钟
- 校验：timingSafeEqual 防时序攻击，过期则失败
- 不依赖 jose 库，纯 Node crypto 实现

### 12.2 服务端 API

`POST /api/auth/verify-password`：
- CSRF + 限流（10次/分钟/IP）+ auth + bcrypt.compare
- 成功返回 `{token, exp}`，客户端存 sessionStorage

### 12.3 客户端 Hook

[`src/components/features/envvault/useSensitiveAuth.tsx`](./src/components/features/envvault/useSensitiveAuth.tsx)：

```typescript
const sensitiveAuth = useSensitiveAuth();
// 返回 { ensureVerified, getToken, clearToken, dialog }

const token = await sensitiveAuth.ensureVerified();
if (!token) return; // 用户取消
// 带 X-Verify-Token 头调用敏感 API
```

- `ensureVerified()`：token 有效则立即返回；否则弹 Dialog 让用户输密码，POST verify-password 拿 token
- token 存 sessionStorage，5 分钟后自动清除
- 401 + VERIFY_REQUIRED 时调 `clearToken()` 强制下次重新认证
- `dialog` 是 JSX 元素，需在组件中渲染

### 12.4 测试覆盖

[`src/lib/auth/__tests__/verify-token.test.ts`](./src/lib/auth/__tests__/verify-token.test.ts) - 10 个用例：签发格式、exp 时间、合法校验、null/undefined、格式错误、签名篡改、payload 反序列化失败、Request 头提取、密钥变更失效。

---

## 十三、工程加固（技术债清单，✅ 全部完成）

### 13.1 数据库索引（✅ 已迁移）

所有外键查询字段加 `@@index`，避免全表扫描。详见 §3.3 索引清单。

### 13.2 CSRF 保护（✅ 已实现）

[`src/lib/auth/csrf.ts`](./src/lib/auth/csrf.ts) - `checkCsrf(request)` 返回 `NextResponse | null`，在 mutating route handler 顶部调用：

```typescript
const csrfError = checkCsrf(request);
if (csrfError) return csrfError;
```

NextAuth 的 `/api/auth/*` 自带 CSRF 保护，无需重复。

### 13.3 限流 + 密码强度（✅ 已实现）

#### 限流（IP 维度）

[`src/lib/auth/rate-limit.ts`](./src/lib/auth/rate-limit.ts) - 内存计数器（单进程够用，生产可换 Upstash Redis）：

```typescript
rateLimit(key: string, max: number, windowMs: number): boolean
getClientIp(request): string  // x-forwarded-for > x-real-ip > 'unknown'
_resetRateLimitForTest(): void  // 测试隔离用
```

实际限流策略：
- 登录接口：5 次/分钟/IP
- 注册接口：3 次/小时/IP
- 二次认证 verify-password：10 次/分钟/IP
- reveal/copy：30 次/分钟/IP
- export：5 次/小时/IP（最高风险）
- rotate：3 次/小时/IP

#### 密码强度

注册时 Zod 校验：最少 8 位，必须包含字母 + 数字。

### 13.4 API 测试（Vitest，✅ 74 个用例全绿）

```bash
pnpm add -D vitest@4.1.9 @vitest/coverage-v8
```

#### 测试文件清单（8 个文件）

| 文件 | 用例数 | 覆盖范围 |
|------|--------|----------|
| `lib/auth/__tests__/csrf.test.ts` | 6 | Origin 缺失/不匹配/合法 |
| `lib/auth/__tests__/rate-limit.test.ts` | 9 | 计数/窗口重置/多 key 隔离 |
| `lib/auth/__tests__/verify-token.test.ts` | 10 | 签发/校验/篡改/过期 |
| `lib/crypto/__tests__/aes.test.ts` | 11 | 加解密/IV 唯一性/错误密钥 |
| `lib/validations/__tests__/envvault.test.ts` | 14 | Zod schema 各种输入 |
| `lib/__tests__/utils.test.ts` | 10 | cn/formatDate/maskSalary |
| `app/api/applications/__tests__/route.test.ts` | 6 | 列表筛选/分页 |
| `app/api/auth/register/__tests__/route.test.ts` | 8 | 注册 + 限流 + 密码强度 |

#### vitest.config.ts

```typescript
export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

---

## 十四、移动端适配规范

- 容器响应式：`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`（已有）
- 表格隐藏列：移动端只显示核心列，已在 ApplicationList/EnvVaultList 实现（`hidden md:table-cell` / `hidden lg:table-cell` / `hidden xl:table-cell`）
- 图表高度：固定 `h-[280px]` ~ `h-[300px]`，避免移动端过高
- Sidebar：移动端需汉堡菜单 + 抽屉式展开（待实现）
- 表单：移动端单列堆叠，桌面端可双列

---

## 十五、动态面包屑（✅ 已实现）

### 15.1 设计

早期 Header 是 Server Component，面包屑硬编码为 "工作台 / 投递管理"，切换路由不更新。现已改为 Client Component + `usePathname()` 动态计算。

### 15.2 共享导航数据

[`src/components/layout/nav-items.ts`](./src/components/layout/nav-items.ts) - Sidebar 和 Header 共用：

- `navSections` - 分组导航（工作台/工具库），用于 Sidebar
- `everyNavItems` - 含 standaloneItems（settings），用于面包屑匹配
- `subPageLabels` - 已知子页后缀映射（`/logs` → 审计日志，`/interviews` → 面试记录）

### 15.3 面包屑计算规则

1. 从 everyNavItems 中按最长前缀匹配找到顶级项，得到 group + label
2. 若 pathname 恰好等于 href → 显示 `group / label`
3. 否则视为子页：
   - 用 subPageLabels 匹配已知后缀（如 `/tools/envvault/logs` → 工具库 / EnvVault / 审计日志）
   - 多段路径（如 `/applications/[id]/interviews`）→ 工作台 / 投递管理 / 详情 / 面试记录
   - 单个动态段（如 `/applications/[id]`）→ 工作台 / 投递管理 / 详情
4. settings 等独立项无 group，只显示单项

### 15.4 效果示例

| 路径 | 面包屑 |
|------|--------|
| `/applications` | 工作台 / 投递管理 |
| `/applications/analytics` | 工作台 / 数据分析 |
| `/applications/[id]` | 工作台 / 投递管理 / 详情 |
| `/applications/[id]/interviews` | 工作台 / 投递管理 / 详情 / 面试记录 |
| `/tools/envvault` | 工具库 / EnvVault |
| `/tools/envvault/logs` | 工具库 / EnvVault / 审计日志 |
| `/interviews/[id]` | 工作台 / 面试日程 / 详情 |
| `/settings` | 设置 |

---

## 十六、部署

### 16.1 Vercel 部署

1. 推送代码到 GitHub
2. Vercel 导入项目
3. 配置环境变量（DATABASE_URL / AUTH_SECRET / AUTH_URL / ENCRYPTION_KEY / ENVAULT_ENCRYPTION_KEY）
4. 部署

### 16.2 数据库迁移

```bash
# 开发环境
pnpm db:migrate --name <name>

# 生产环境
npx prisma migrate deploy
```

---

## 十七、后续扩展 (Phase 2)

### 17.1 待开发模块

- **JSON 工具**（✅ 已完成）：格式化/压缩、命名风格转换（含保护 key + 命中反馈）、JSON 对比、JSONPath 提取
- **Snapshot Diff**（✅ 已完成）：JSON/XML/文本快照保存与可视化差异对比（行级 LCS diff + JSON 深度 diff 自动切换）
- **Changelog**（✅ 已完成）：版本管理 + 变更分类（NEW/FIX/IMPROVED/BREAKING）+ 截图归档 + 按类型分组展示 + 事务化 changes 整体替换
- **AI Agent**（⏳ 待开发）：Vercel AI SDK + DeepSeek API，自然语言交互

### 17.2 移动端 Sidebar 抽屉

当前 Sidebar 在移动端固定占位，需改为汉堡菜单 + 抽屉式展开。

### 17.3 通知系统

- 站内通知（面试提醒）
- 邮件通知（可选）

### 17.4 生产化加固

- 限流从内存换 Upstash Redis
- 审计日志导出/检索
- EnvVault 密钥轮换定时任务

---

*Spec Version: 3.4.0*  
*Locked: Next.js 16.2.9 + React 19.2.4 + Prisma 7.8 + Tailwind v4 + shadcn/ui + Recharts 3.9.1 + Vitest 4.1.9*  
*Last Updated: 2026-07-14*
