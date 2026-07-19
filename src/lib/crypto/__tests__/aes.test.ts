import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { encrypt, decrypt, isEncryptionConfigured } from '../aes';

describe('aes 加密工具', () => {
  const originalKey = process.env.ENVAULT_ENCRYPTION_KEY;

  beforeEach(() => {
    // 测试用固定密钥
    process.env.ENVAULT_ENCRYPTION_KEY = 'test-key-for-vitest-only-do-not-use-in-prod';
  });

  afterEach(() => {
    process.env.ENVAULT_ENCRYPTION_KEY = originalKey;
  });

  describe('isEncryptionConfigured', () => {
    it('密钥已配置返回 true', () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it('密钥未配置返回 false', () => {
      delete process.env.ENVAULT_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it('密钥过短（<16 字符）返回 false', () => {
      process.env.ENVAULT_ENCRYPTION_KEY = 'short';
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe('encrypt + decrypt', () => {
    it('能正确加解密普通字符串', () => {
      const plaintext = 'hello world';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext.split('.')).toHaveLength(3); // iv.cipher.tag
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('能正确加解密特殊字符（引号、换行、emoji）', () => {
      const plaintext = 'value with "quotes" and\nnewlines\nand emoji 🚀';
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('能正确加解密空字符串', () => {
      const plaintext = '';
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('能正确加解密超长字符串', () => {
      const plaintext = 'a'.repeat(10000);
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('相同明文每次加密产生不同密文（IV 随机）', () => {
      const plaintext = 'same-value';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      // 但都能解密为同一明文
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });
  });

  describe('decrypt 错误处理', () => {
    it('密文格式错误（不是三段）抛错', () => {
      expect(() => decrypt('invalid-ciphertext')).toThrow('密文格式错误');
    });

    it('密文被篡改抛错（GCM 完整性校验）', () => {
      const plaintext = 'sensitive-value';
      const ciphertext = encrypt(plaintext);
      // 篡改密文段
      const [ivB64, encB64, tagB64] = ciphertext.split('.');
      const tampered = `${ivB64}.${encB64.slice(0, -2)}xx.${tagB64}`;
      expect(() => decrypt(tampered)).toThrow();
    });

    it('密钥变更后无法解密旧密文', () => {
      const plaintext = 'old-key-data';
      const ciphertext = encrypt(plaintext);
      // 切换密钥
      process.env.ENVAULT_ENCRYPTION_KEY = 'another-different-key-for-testing';
      expect(() => decrypt(ciphertext)).toThrow();
    });
  });
});
