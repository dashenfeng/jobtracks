import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

// 加载 .env
const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // ⚠️ 安全保护：生产环境跳过测试账号创建，避免部署后存在已知密码的账号
  if (process.env.NODE_ENV === 'production') {
    console.log('Production 环境跳过测试账号 seed');
    return;
  }
  const password = await bcrypt.hash('123456', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@jobtracks.com' },
    update: {},
    create: {
      email: 'test@jobtracks.com',
      name: '测试用户',
      password,
    },
  });
  console.log('Seed 完成（仅本地开发用）:', user.email);
}

main()
  .catch((e) => {
    console.error('Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
