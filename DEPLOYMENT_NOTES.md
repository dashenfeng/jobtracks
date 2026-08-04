# 职迹项目部署总结 & 面试备考

> 部署时间：2026-07-26
> 最后更新：2026-08-04（所有生产环境问题已修复）
> 部署目标：将 Next.js 16 + Prisma 7 + NextAuth v5 项目上线公网，供朋友访问
> 最终架构：Vercel（应用）+ Prisma Postgres（数据库）+ Cloudflare（CDN/DNS）+ 阿里云（域名）
> 当前状态：✅ 全部问题已修复，所有修复已合入 main 并推送，Vercel 自动部署中

---

## 一、最终架构

```
┌──────────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  用户浏览器          │ →   │  Cloudflare     │ →   │  Vercel          │
│  (国内/移动网络)     │     │  (CDN+DNS+SSL)  │     │  (Next.js SSR)  │
└──────────────────────┘     └─────────────────┘     └──────────────────┘
                                                            ↓
                                                  ┌──────────────────┐
                                                  │  Prisma Postgres│
                                                  │  (数据库)        │
                                                  └──────────────────┘
```

**域名链路**：`app.jobtracks.xyz` → Cloudflare 橙云代理 → CNAME 到 `cname.vercel-dns.com` → Vercel 自动签发 SSL → Next.js 应用

---

## 二、部署流程（按顺序）

### 阶段 1：Vercel 部署应用

1. **Vercel 导入 GitHub 项目**
   - 选 Hobby 档（免费，超额自动停服不扣费）
2. **配置环境变量**
   - `AUTH_SECRET`：NextAuth JWT 加密密钥
   - `ENCRYPTION_KEY`：EnvVault AES-256-GCM 加密密钥
   - `DEEPSEEK_API_KEY`：AI Agent 调用密钥
   - `DATABASE_URL`：稍后由 Prisma Postgres 自动注入
3. **创建 Prisma Postgres**
   - 免费档：500MB 存储 / 100K 月操作数
   - 创建后自动注入 `DATABASE_URL` 和 `DIRECT_URL` 环境变量
4. **配置 build 命令自动迁移**
   - `package.json` 的 `vercel-build` 脚本：`prisma generate && prisma migrate deploy && next build`
5. **首次部署失败**（预期内）
   - 原因：数据库还没迁移，Prisma Client 调用失败
6. **手动迁移**（本地连生产库）
   - PowerShell 临时设置 `DATABASE_URL`
   - 运行 `pnpm exec prisma migrate deploy`
7. **重新部署** → Ready

### 阶段 2：冒烟测试

通过 Playwright 自动化测试核心功能：

| 模块 | 结果 | 关键发现 |
|---|---|---|
| EnvVault 加密存储 | ✅ | 二次验证选择器用 `[role=dialog] button:has-text('验证')` |
| Changelog | ✅ | 路径 `/tools/changelog` |
| Snapshot | ✅ | 路径 `/tools/snapshots`（复数） |
| AI 助手 | ✅ | 流式响应正常 |
| 移动端响应式 | ⚠️ | Header 拥挤、EnvVault 溢出 21px |

### 阶段 3：域名 + CDN 配置

1. **阿里云购买 `.xyz` 域名**
   - 选 `.xyz` 而非 `.top`：`jobtracks` 在 `.top` 是溢价词（¥14），`.xyz` 是常规价（¥1 起首年）
2. **Cloudflare 接入**
   - Cloudflare "Add a Site" → 选 Free 套餐
   - Cloudflare 给两个 NS：`chad.ns.cloudflare.com`、`maeve.ns.cloudflare.com`
3. **修改阿里云 NS**
   - 删除 `dns15.hichina.com` / `dns16.hichina.com`
   - 替换为 Cloudflare 给的两个 NS
4. **加 CNAME 记录**
   - Type: `CNAME`，Name: `app`，Target: `cname.vercel-dns.com`
   - **Proxy: Proxied（橙云开启，关键）**
5. **Vercel 绑定域名**
   - Settings → Domains → Add `app.jobtracks.xyz`
   - 自动签发 SSL 证书
6. **加 `AUTH_URL` 环境变量**（关键修复）
   - Vercel → Settings → Environment Variables
   - `AUTH_URL = https://app.jobtracks.xyz`（仅 Production）
7. **Redeploy** + 清浏览器 cookie → 测试通过

---

## 三、踩坑总结（按出现顺序）

### 坑 1：Playwright chromium 版本不匹配

**现象**：MCP 服务期望 `chromium-1200`，本地装的是 `chromium-1228/1234`，启动报错。

**原因**：`@playwright/mcp` 包依赖的 chromium 版本和本地 `playwright install` 装的不一致。

**解决**：复制 `chromium-1228` 目录为 `chromium-1200`（粗暴但有效）。

**知识点**：
- Playwright 通过浏览器版本号隔离二进制
- MCP（Model Context Protocol）服务可能锁版本

---

### 坑 2：Vercel 敏感环境变量无法查看

**现象**：Vercel 后台只能看到 `DATABASE_URL` 是 `Encrypted`，看不到值。

**原因**：Vercel 对标记为 Sensitive 的变量只写不读，防止泄露。

**解决**：用 Prisma Console 的 `psql` 直连获取连接串，或者直接重置变量重新填。

**知识点**：
- Vercel Sensitive Variables 设计：避免泄露给 CI 日志/客户端 bundle
- Prisma Postgres 提供两种连接串：
  - 直连串（`postgresql://...db.pg.zone:5432/...`）：用于迁移
  - 连接池串（`postgresql://...db.pg.zone:6543/...?pgbouncer=true`）：用于运行时
- **关键**：`prisma migrate deploy` 必须用直连串，连接池串会让事务模式出错

---

### 坑 3：投递统计卡片不自动刷新

**现象**：创建投递后，统计数字仍显示 0，手动刷新页面后才正确。

**原因**：Server Component 缓存，客户端操作后没有触发服务端数据重新拉取。

**解决**：在客户端 mutation 后调用 `router.refresh()`，让 Next.js 重新执行 Server Component。

**知识点**：
- Next.js App Router 的 Server Component 默认会被缓存
- `router.refresh()` 会重新拉取当前路由的 Server Component，但不刷新 Client Component 状态
- 类似 React Query 的 `invalidateQueries`，但更粗暴

---

### 坑 4：薪资显示异常 `30-50K·16薪` → `**-**K·**薪` ✅ 已修复

**现象**：数字被替换成 `*`，看起来像渲染 bug。

**原因**：`SalaryCell` 组件在 `visible=false` 时会调 `maskSalary` 把所有数字替换成 `*`，但 UI 上没有任何"已隐藏"的提示，用户（包括我自己）第一眼都以为是渲染错误。

**解决**：在掩码状态下加 `EyeOff` 图标和 tooltip，文字色弱化区分明文/掩码。

```tsx
import { EyeOff } from 'lucide-react';

return (
  <span
    className="inline-flex items-center gap-1 text-sm text-muted-foreground/70 tabular-nums"
    title="薪资已隐藏，点击切换显示"
  >
    <EyeOff className="size-3" aria-hidden />
    <span>{maskSalary(value)}</span>
  </span>
);
```

**知识点**：
- **掩码 ≠ Bug**：脱敏显示必须有视觉提示，否则用户会误以为渲染错误
- 用 `text-muted-foreground/70` 弱化掩码文字色，明文用 `text-foreground`，形成视觉对比
- `tabular-nums` 让数字等宽，切换明文/掩码时不会抖动

---

### 坑 5：通知系统未触发 ✅ 已修复

**现象**：投递状态变更后，通知列表里没有 `STATUS_CHANGED` 记录。

**原因**：`/api/applications/[id]/status/route.ts` 里没调用 `notifyApplicationStatusChanged`。

**解决**：

```typescript
// 在 PATCH 处理器里，状态变化时异步触发通知
if (existing.status !== parsed.data.status) {
  notifyApplicationStatusChanged(
    session.user.id,
    { id: existing.id, companyName: existing.companyName, jobTitle: existing.jobTitle },
    existing.status,
    parsed.data.status,
  ).catch((e) => console.error('[notifications] status change notify failed:', e));
}
```

**关键点**：
- 用 `.catch()` 而非 `await`：通知失败不应阻塞主业务（写状态）
- 查询 `existing` 时要 `select` 出 `companyName/jobTitle`，通知内容要用

**知识点**：
- **异步副作用模式**：主业务先返回成功，副作用（通知/日志/邮件）异步执行
- 避免让通知服务的失败拖垮主流程

---

### 坑 6：DeepSeek API 模型名变更 ✅ 已修复

**现象**：AI Agent 调用失败，错误：`The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-chat`

**原因**：DeepSeek 升级了模型命名，旧名 `deepseek-chat` 被废弃。

**解决**：

```typescript
// 旧：const model = 'deepseek-chat';
// 新：
const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
```

**改进点**：把模型名做成环境变量，未来再变更不用改代码。

**知识点**：
- **配置优于代码**：模型名、API base URL、超时时间等可变配置都应放环境变量
- DeepSeek 兼容 OpenAI Chat Completions API，但不支持 Responses API
- `@ai-sdk/openai` v4 默认走 Responses API，必须用 `.chat()` 显式指定

---

### 坑 7：移动端 Header 拥挤 ✅ 已修复

**现象**：iPhone 14 Pro 视口下 Header 元素挤在一起。

**原因**：搜索框在移动端没必要显示，但布局没做响应式。

**解决**：

```tsx
// 搜索框
<div className="hidden md:flex ...">  // 移动端隐藏
// 右侧间距
<div className="flex items-center gap-2 sm:gap-4">
```

**知识点**：
- Tailwind 响应式断点：`sm:` (640px), `md:` (768px), `lg:` (1024px)
- 移动优先：默认样式给移动端，`md:` 给桌面端覆盖

---

### 坑 8：EnvVault 移动端水平溢出 ✅ 已修复

**现象**：4 个操作按钮在移动端撑爆容器，水平滚动条 21px。

**原因**：`flex items-center gap-2` 不换行。

**解决**：

```tsx
// 旧：flex items-center gap-2
// 新：
<div className="flex flex-wrap items-center justify-end gap-2">
```

**知识点**：
- `flex-wrap`：移动端小屏必备
- `justify-end`：保持桌面端按钮靠右对齐

---

### 坑 9：朋友打不开部署平台（最严重）

**现象**：用户电脑能访问 `jobtracks.vercel.app`，朋友和用户手机都不行。

**诊断**：本地 Playwright 报错 `connect ETIMEDOUT 2a03:2880:f126:83:face:b00c:0:25de:443`

**根因**：错误信息里的 IPv6 地址 `2a03:2880:f126:83:face:b00c:0:25de` 是 **Facebook/Meta 的服务器 IP**（`face:b00c` 是 Facebook 标志性地址）。

**真相**：国内 ISP 的 DNS 把 `*.vercel.app` 解析到了 Facebook 的 IP（DNS 污染/投毒）。这不是 Vercel 封了你，是国内的 DNS 封了 Vercel。

**验证**：

```powershell
# 用 Cloudflare DoH 查真实 IP
Resolve-DnsName jobtracks.vercel.app -Server 1.1.1.1 -Type A
# 用阿里 DNS 查
nslookup jobtracks.vercel.app 223.5.5.5
```

两个返回的 IP 完全不同 → DNS 污染实锤。

**解决**：买域名 + Cloudflare CDN 反代。

**知识点**：
- **DNS 污染（DNS Poisoning）**：国内 ISP 通过伪造 DNS 响应，把特定域名指向错误 IP
- `*.vercel.app` 在国内部分被污染，导致直连失败
- Cloudflare 的 IP 在国内大部分能正常解析（CDN 节点也是全球分布）
- 朋友端不需要装任何东西，直接访问 `app.jobtracks.xyz` 即可

---

### 坑 10：NextAuth callbackUrl 跳回 vercel.app

**现象**：访问 `https://app.jobtracks.xyz`，URL 变成 `https://app.jobtracks.xyz/login?callbackUrl=https%3A%2F%2Fjobtracks.vercel.app%2F`，登录后跳转回 vercel.app，手机又访问不了。

**原因**：NextAuth v5 在 Vercel 上自动使用 `VERCEL_URL` 环境变量（Vercel 自动注入，值是 `<project>.vercel.app`）作为信任的 host，所以生成的 callbackUrl 永远指向 vercel.app 域名。

**解决**：在 Vercel 添加环境变量覆盖：

```
AUTH_URL = https://app.jobtracks.xyz   (仅 Production)
```

**关键步骤**：
1. 加环境变量
2. Redeploy 让环境变量生效
3. **清浏览器 cookie**：旧的 callbackUrl cookie 会残留，必须清

**知识点**：
- NextAuth v5 的 host 检测优先级：`AUTH_URL` > `VERCEL_URL` > `request.headers.host`
- `AUTH_TRUST_HOST=true`：信任请求里的 Host 头（多域名访问必备）
- `AUTH_URL`：显式指定回跳域名（覆盖自动检测）
- **Cookie 域名陷阱**：旧 cookie 是 vercel.app 域名下的，新域名 app.jobtracks.xyz 不共享

---

### 坑 11：NotificationBell Popover 打开后立即关闭 ✅ 已修复

**现象**：点击通知铃铛，Popover 闪一下就关闭，根本来不及点通知里的项。Sheet（移动端）没问题，只有桌面 Popover 有问题。

**原因**：轮询逻辑 + 受控 Popover 的冲突。

原始实现里，每 10 秒轮询 `/api/notifications?pageSize=1` 拉未读数，无论 unreadCount 是否变化都会 `setData(json)` 创建一个**新对象**。React 看到 state 引用变了就触发重渲染，把正打开的 Popover 顶关。

```typescript
// 原始的有问题代码
const json: ListResponse = await res.json();
setData(json);  // 每次都创建新对象 → 重渲染 → Popover 被顶关
```

**解决**：用 `setData(prev => ...)` 的函数式更新，**只有 unreadCount 真正变化时才创建新对象**，否则返回 prev（引用不变，React 跳过重渲染）。

```typescript
setData((prev) => {
  // 未读数没变 → 不创建新对象，跳过重渲染
  if (prev && prev.unreadCount === json.unreadCount) return prev;
  // 已打开列表时不覆盖 items，避免把已加载的列表冲掉
  if (prev) return { ...prev, unreadCount: json.unreadCount };
  return { ...json, items: [] };
});
```

**关键点**：
- 即使 fetch 返回的 json 数据"看起来一样"，引用也是新的，React 会重渲染
- 必须用 `setData(prev => prev.unreadCount === json.unreadCount ? prev : ...)` 显式判断
- 还要处理"列表已加载时不被覆盖"：`if (prev) return { ...prev, unreadCount }` 保留 items

**知识点**：
- **React 引用相等性**：`setState(新对象)` 总会触发重渲染，即使内容相同
- **函数式更新**：`setState(prev => prev)` 返回 prev 时，React 会跳过重渲染（bailout）
- **受控 Popover 的脆弱性**：`open` 状态被父组件 state 控制，父组件任何重渲染都可能影响 Popover
- 轮询组件设计原则：**只在数据真正变化时更新 state**，否则无谓重渲染

---

## 四、知识点详解

### 4.1 Vercel 部署

**核心概念**：
- **Hobby 档**：免费，但商业项目需付费；超额自动停服不扣费
- **Serverless Functions**：API 路由按需启动，冷启动有延迟
- **Edge Runtime vs Node.js Runtime**：
  - Edge：全球边缘节点，启动快，但不支持 Node API（如 bcrypt、Prisma）
  - Node.js：完整 Node 环境，支持所有特性，但只在某区域运行
- **环境变量作用域**：Production / Preview / Development 三套

**项目配置**：
- `next.config.ts`：Next.js 配置
- `vercel.json`：Vercel 特定配置（可选）
- `package.json` 的 `vercel-build` 脚本：Vercel 构建入口

---

### 4.2 Prisma Postgres

**核心概念**：
- Prisma 官方托管的 PostgreSQL，免费档 500MB
- 提供两种连接方式：
  - **Pooled URL**（端口 6543）：用 PgBouncer，适合 Serverless
  - **Direct URL**（端口 5432）：直连，适合迁移

**关键配置**（`prisma.config.ts`）：

```typescript
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL, // 连接池串
  },
  // 迁移时用直连串
});
```

**部署时的迁移命令**：

```bash
prisma migrate deploy     # 生产环境用，只跑已存在的 migration
pr migrate dev            # 开发环境用，会生成新 migration
```

⚠️ **坑**：`prisma migrate deploy` 必须用 `DIRECT_URL`，不能用连接池串，否则会报 `Transaction API error`。

---

### 4.3 NextAuth v5 配置

**核心文件结构**（避免 Edge Runtime 报错）：

```
src/
├── auth.config.ts          # Edge 安全配置（无 bcrypt/db）
├── lib/auth/
│   ├── edge-config.ts      # proxy.ts 用
│   └── full-config.ts     # API 路由用
└── proxy.ts                # 中间件，Edge Runtime
```

**关键环境变量**：

| 变量 | 作用 | 必需 |
|---|---|---|
| `AUTH_SECRET` | JWT 加密密钥 | ✅ 必需 |
| `AUTH_URL` | 显式指定回跳域名 | 多域名时必需 |
| `AUTH_TRUST_HOST` | 信任请求里的 Host 头 | 反代时必需 |

**Credentials Provider 注意**：
- 不要配 PrismaAdapter（会导致 session 创建失败）
- 自己在 `authorize` 里查库 + 验密码
- Session 用 JWT 策略，不用 database strategy

---

### 4.4 DNS / CDN / Cloudflare

**DNS 基础**：
- **A 记录**：域名 → IPv4
- **CNAME 记录**：域名 → 另一个域名（如 `app.jobtracks.xyz` → `cname.vercel-dns.com`）
- **NS 记录**：指定由哪些 DNS 服务器解析这个域名

**域名层级**：
- 根域名 `.`
- 顶级域（TLD）：`.com`、`.xyz`、`.top`、`.cn`
- 二级域：`jobtracks.xyz`
- 三级域（子域）：`app.jobtracks.xyz`

**Cloudflare 工作原理**：
1. 你把 NS 改成 Cloudflare 的 NS
2. Cloudflare 接管 DNS 解析
3. 开启橙云（Proxied）后，Cloudflare 用自己的 IP 反代你的源站
4. 用户访问 `app.jobtracks.xyz` → Cloudflare 边缘节点 → 回源到 Vercel

**Cloudflare SSL/TLS 模式**：
- **Off**：不加密（别选）
- **Flexible**：用户→CF 加密，CF→源站不加密（会无限重定向）
- **Full**：两端都加密，但源站证书不验证
- **Full (strict)**：两端都加密，且验证源站证书（推荐）

**橙云 vs 灰云**：
- 橙云（Proxied）：走 Cloudflare CDN，隐藏源站 IP，加速 + 防御
- 灰云（DNS only）：只用 Cloudflare 的 DNS，不走 CDN

---

### 4.5 DNS 污染

**原理**：
1. 用户查询 `jobtracks.vercel.app`
2. 国内 ISP 的 DNS 服务器（如 `8.8.8.8` 国内镜像）伪造响应
3. 返回一个错误 IP（如 Facebook 的 IP）
4. 用户连接错误 IP，超时

**为什么污染 vercel.app**：
- Vercel 在国内被列入"敏感域名"列表
- 部分 ISP 全量污染，部分按需污染
- 与 GFW 的关键字匹配有关

**解决方案对比**：
- 用户端：换 DNS（223.5.5.5）+ DoH + WARP（要求用户操作，体验差）
- 服务端：用国内能解析的域名 + CDN（用户无感，推荐）

---

### 4.6 HTTPS / SSL 证书

**Vercel 自动签发**：
- Vercel 绑定域名后，自动用 Let's Encrypt 签发 SSL 证书
- 续期自动，无需操心
- 通过 Vercel 的 SNI 提供 HTTPS

**Cloudflare SSL**：
- Cloudflare 也提供免费 SSL（Edge Certificates）
- 配合 Vercel 的证书，形成"双重 HTTPS"（用户→CF→Vercel）

---

### 4.7 Playwright 自动化测试

**核心能力**：
- 页面导航 + 截图
- 元素交互（点击、填写、选择）
- 网络请求监听
- 多视角测试（桌面/移动端）

**常用选择器**：
- `text=登录`：按文本
- `[data-testid="xxx"]`：按 testid（推荐）
- `[role=dialog] button:has-text('验证')`：组合选择器
- `getByRole('button', { name: '登录' })`：语义化

**响应式测试**：

```typescript
await playwright_resize({ width: 390, height: 844 }); // iPhone 14 Pro
await playwright_resize({ width: 1280, height: 800 }); // 桌面
```

---

## 五、面试问答准备

### Q1: 为什么选 Vercel 而不是自建服务器？

**答**：
- 项目是 Next.js，Vercel 是 Next.js 母公司，零配置部署
- 自动 CI/CD（git push 即部署）
- 全球 CDN + 自动 HTTPS
- Hobby 档免费够用，超额自动停服不扣费
- 缺点：国内访问 vercel.app 被 DNS 污染，需要自定义域名 + Cloudflare

---

### Q2: Prisma Postgres 和自己装 PostgreSQL 有什么区别？

**答**：
- Prisma Postgres 是 Prisma 官方托管的 PG，免运维
- 提供 PgBouncer 连接池，适合 Serverless 函数短连接
- 免费档 500MB / 100K 月操作数，足够个人项目
- 缺点：付费档较贵，且只能通过 Prisma 访问（直连有限制）

---

### Q3: 你的 NextAuth 为什么拆成 edge-config 和 full-config？

**答**：
- Next.js 16 中间件（proxy.ts）运行在 Edge Runtime
- Edge Runtime 不支持 Node API（如 `bcrypt`、`Prisma Client`）
- 如果把含 bcrypt + Prisma 的 full-config 给中间件用，会报 crypto 错误
- 解决：拆成两份
  - `edge-config.ts`：只含 pages、session、callbacks，Edge 安全
  - `full-config.ts`：继承 edge-config，再加 Credentials Provider + Prisma
- 中间件用 edge-config，API 路由用 full-config

---

### Q4: DNS 污染是什么？怎么解决的？

**答**：
- DNS 污染：国内 ISP 伪造 DNS 响应，把特定域名指向错误 IP
- 现象：用户本地 Playwright 报错 `connect ETIMIDOUT 2a03:2880:f126:83:face:b00c:0:25de`，IP 是 Facebook 的
- 解决：
  1. 阿里云买 `.xyz` 域名（避开 `.top` 溢价词）
  2. 接入 Cloudflare，修改 NS 到 Cloudflare
  3. 加 CNAME `app` → `cname.vercel-dns.com`，开启橙云代理
  4. Vercel 绑定 `app.jobtracks.xyz`
- 原理：Cloudflare 的 IP 在国内能正常解析，CDN 节点回源到 Vercel

---

### Q5: NextAuth 的 callbackUrl 为什么跳回 vercel.app？

**答**：
- Vercel 会自动注入 `VERCEL_URL` 环境变量，值是 `<project>.vercel.app`
- NextAuth v5 自动检测 `VERCEL_URL` 作为信任 host
- 导致生成的 callbackUrl 永远指向 vercel.app
- 用户登录成功跳转回 vercel.app，又被 DNS 污染访问不了
- 解决：加环境变量 `AUTH_URL=https://app.jobtracks.xyz` 覆盖自动检测
- 关键细节：改完要 Redeploy + 清浏览器 cookie，否则旧 cookie 会残留

---

### Q6: 为什么通知服务用 `.catch()` 而不是 `await`？

**答**：
- 通知是**异步副作用**，主业务（状态变更）已经成功
- 通知失败不应该阻塞主流程返回给用户
- 用 `.catch()` 而非 `await`：
  - 主流程立即返回成功
  - 通知在后台执行
  - 通知失败只记日志，不抛错
- 类比：发邮件、写日志、统计上报都是异步副作用

---

### Q7: Cloudflare 橙云和灰云的区别？

**答**：
- **橙云（Proxied）**：流量经过 Cloudflare 代理
  - 隐藏源站 IP
  - CDN 加速
  - DDoS 防御
  - WAF 防火墙
- **灰云（DNS only）**：只解析 DNS，流量直连源站
  - 用于不需要代理的子域（如邮件 MX 记录）
- 我的项目 `app.jobtracks.xyz` 必须开橙云，才能让国内用户通过 Cloudflare CDN 访问

---

### Q8: 你怎么测试移动端响应式？

**答**：
- 用 Playwright 的 `playwright_resize` 设置视口
- iPhone 14 Pro：390×844
- 桌面：1280×800
- 用 `playwright_evaluate` 检测 `document.documentElement.scrollWidth > window.innerWidth` 判断水平溢出
- 测试核心页面：投递管理、AI 助手、EnvVault、Snapshot、Changelog
- 发现两个问题：
  - Header 在移动端拥挤（搜索框没隐藏）
  - EnvVault 按钮溢出 21px（flex 没换行）
- 修复用 `hidden md:flex` 和 `flex-wrap`

---

### Q9: 部署生产数据库迁移怎么做的？

**答**：
- 配置 `package.json` 的 `vercel-build` 脚本，自动跑 `prisma migrate deploy`
- 第一次部署会失败（数据库还没迁移），属于预期
- 手动迁移流程：
  1. 从 Vercel 环境变量获取 `DATABASE_URL`（或 Prisma Console 拿直连串）
  2. PowerShell 临时设置 `$env:DATABASE_URL = "..."`（不入 git）
  3. 运行 `pnpm exec prisma migrate deploy`
  4. 运行 `pnpm exec prisma generate` 重新生成 Client
- 关键坑：迁移必须用**直连串**，不能用连接池串（会报 Transaction API error）

---

### Q10: 你的项目怎么做 CSRF 防护的？

**答**：
- NextAuth v5 自带 CSRF token（基于 cookie + Authorization header）
- 自定义 mutating API（PATCH/DELETE/POST）额外做 Origin 头校验：
  - 检查 `request.headers.get('origin')` 是否在白名单
  - 白名单包含 `http://localhost:3000`、`https://app.jobtracks.xyz`
- 配置 `AUTH_TRUST_HOST=true` 让 NextAuth 接受反代后的 Host 头

---

## 六、待办（全部完成 ✅）

- [x] ✅ 修复 NotificationBell Popover 无法打开（详见坑 11）
- [x] ✅ 修复薪资显示异常（详见坑 4）
- [x] ✅ 修复移动端 Header 拥挤（详见坑 7）
- [x] ✅ 修复 EnvVault 移动端溢出（详见坑 8）
- [x] ✅ 修复 AI Agent DeepSeek 模型名变更（详见坑 6）
- [x] ✅ 修复通知系统未触发（详见坑 5）

---

## 七、关键配置文件清单

| 文件 | 作用 |
|---|---|
| `package.json` | `vercel-build` 脚本 |
| `prisma.config.ts` | Prisma 配置（datasource + migrations） |
| `src/auth.config.ts` | NextAuth Edge 安全配置 |
| `src/lib/auth/full-config.ts` | NextAuth 完整配置（含 Credentials） |
| `src/proxy.ts` | 中间件，Edge Runtime，鉴权 |
| `next.config.ts` | Next.js 配置 |
| `.env.example` | 环境变量模板（不入 git） |

## 八、生产环境变量清单

| 变量 | 作用 | 必需 |
|---|---|---|
| `AUTH_SECRET` | NextAuth JWT 密钥 | ✅ |
| `AUTH_URL` | 显式回跳域名 | ✅（多域名时） |
| `AUTH_TRUST_HOST` | 信任 Host 头 | ✅（反代时） |
| `DATABASE_URL` | 数据库连接池串 | ✅ |
| `DIRECT_URL` | 数据库直连串（迁移用） | ✅ |
| `DEEPSEEK_API_KEY` | AI Agent 调用密钥 | ✅ |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | 可选，默认 `deepseek-v4-flash` |
| `ENCRYPTION_KEY` | EnvVault AES-256-GCM 密钥 | ✅ |

---

## 九、最终验证

访问 `https://app.jobtracks.xyz`：
- ✅ 用户电脑能访问
- ✅ 用户手机能访问（4G/5G）
- ✅ 朋友电脑能访问
- ✅ 登录、投递管理、AI 助手、EnvVault、Snapshot、Changelog 全部正常
- ✅ F12 看到 `Server: cloudflare` 说明走 CDN
- ✅ SSL 证书有效（Vercel 自动签发）

---

**部署总耗时**：约 4 小时（含排错）
**总成本**：¥1 域名首年 + ¥0 Vercel + ¥0 Cloudflare + ¥0 Prisma Postgres = **¥1**
