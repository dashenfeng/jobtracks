import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM 对称加密工具
 *
 * - 主密钥从环境变量 ENVAULT_ENCRYPTION_KEY 读取（任意长度字符串）
 * - 用 scrypt 派生为 32 字节密钥（满足 AES-256）
 * - 每条数据独立 IV，密文格式：base64(iv).base64(ciphertext).base64(authTag)
 *
 * 安全说明：
 * - GCM 模式自带完整性校验，密文被篡改会抛错
 * - IV 不复用，每次 encrypt 都重新生成
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // GCM 推荐 12 字节
const KEY_LEN = 32; // AES-256

function getKey(): Buffer {
  const raw = process.env.ENVAULT_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'ENVAULT_ENCRYPTION_KEY 未配置或过短（至少 16 字符）。请在 .env.local 中设置。',
    );
  }
  // 用固定 salt 派生密钥（salt 本身不需要保密，但应固定以保证同一密钥能解密历史数据）
  return scryptSync(raw, 'jobtracks-envvault-salt', KEY_LEN);
}

/** 加密明文，返回拼接后的密文字符串 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${enc.toString('base64')}.${tag.toString('base64')}`;
}

/** 解密密文，返回明文；密文被篡改或密钥错误会抛错 */
export function decrypt(ciphertext: string): string {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) {
    throw new Error('密文格式错误');
  }
  const [ivB64, encB64, tagB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const enc = Buffer.from(encB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** 仅用于启动时校验密钥配置可用 */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
