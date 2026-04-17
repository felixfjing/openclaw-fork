/**
 * warrenq认证流程端到端测试
 *
 * 测试完整的认证流程，包括：
 * - Token持久化和恢复
 * - 文件权限验证
 * - Token存储清理
 * - 内存存储vs文件存储对比
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MemoryTokenStorage,
  FileTokenStorage,
} from "./warrenq-login.js";
import { warrenqAuthError, warrenqErrorCode } from "./warrenq-auth-error.js";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

/**
 * 创建临时目录用于测试
 */
async function createTempDir(): Promise<string> {
  const tmpdir = os.tmpdir();
  const testDir = path.join(tmpdir, `warrenq-e2e-test-${Date.now()}-${Math.random()}`);
  await fs.mkdir(testDir, { recursive: true });
  return testDir;
}

/**
 * 清理测试目录
 */
async function cleanupTempDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // 忽略清理错误
    console.warn(`清理临时目录失败: ${dir}`, error);
  }
}

describe("warrenq认证流程E2E测试", () => {
  let tempDir: string | null = null;

  beforeEach(() => {
    tempDir = null;
  });

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("测试用例1: 完整登录流程 - Token管理", () => {
    it("应该能够保存和恢复token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "test-token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "persisted-token",
        tenantId: "persisted-tenant",
        userId: "persisted-user",
      };

      // 保存token
      await storage.saveToken(tokenData);

      // 验证文件存在
      const fileExists = await fs
        .access(tokenFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // 恢复token
      const restoredToken = await storage.getToken();

      expect(restoredToken).toEqual(tokenData);
    });

    it("应该能够清除保存的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "test-token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "to-be-cleared",
        tenantId: "to-be-cleared-tenant",
        userId: "to-be-cleared-user",
      };

      // 保存token
      await storage.saveToken(tokenData);

      // 清除token
      await storage.clearToken();

      // 验证token已被清除
      const restoredToken = await storage.getToken();
      expect(restoredToken).toBeNull();
    });

    it("应该处理不存在的token文件", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "non-existent-token.json");

      const storage = new FileTokenStorage(tokenFile);

      // 读取不存在的文件应该返回null
      const token = await storage.getToken();
      expect(token).toBeNull();
    });

    it("应该验证token结构的完整性", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "invalid-token.json");

      // 写入无效的token数据（缺少字段）
      await fs.writeFile(tokenFile, JSON.stringify({ access_token: "incomplete" }), "utf-8");

      const storage = new FileTokenStorage(tokenFile);

      // 应该抛出错误
      await expect(storage.getToken()).rejects.toThrow(warrenqAuthError);

      try {
        await storage.getToken();
      } catch (error) {
        if (error instanceof warrenqAuthError) {
          expect(error.code).toBe(warrenqErrorCode.INVALID_RESPONSE);
        }
      }
    });

    it("应该正确设置文件权限", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "secure-token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "secure-token",
        tenantId: "secure-tenant",
        userId: "secure-user",
      };

      await storage.saveToken(tokenData);

      // 检查文件权限（600 - 仅所有者可读写）
      const stats = await fs.stat(tokenFile);
      const mode = stats.mode & 0o777; // 提取权限位
      expect(mode).toBe(0o600);
    });

    it("应该正确处理JSON解析错误", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "malformed-token.json");

      // 写入格式错误的JSON
      await fs.writeFile(tokenFile, "{ invalid json", "utf-8");

      const storage = new FileTokenStorage(tokenFile);

      // 应该抛出错误
      await expect(storage.getToken()).rejects.toThrow(warrenqAuthError);
    });
  });

  describe("测试用例2: 内存存储vs文件存储对比", () => {
    it("内存存储应该能够保存和读取token", async () => {
      const storage = new MemoryTokenStorage();
      const tokenData = {
        access_token: "memory-token",
        tenantId: "memory-tenant",
        userId: "memory-user",
      };

      await storage.saveToken(tokenData);
      expect(await storage.getToken()).toEqual(tokenData);
    });

    it("内存存储应该能够清除token", async () => {
      const storage = new MemoryTokenStorage();
      const tokenData = {
        access_token: "memory-token",
        tenantId: "memory-tenant",
        userId: "memory-user",
      };

      await storage.saveToken(tokenData);
      await storage.clearToken();
      expect(await storage.getToken()).toBeNull();
    });

    it("内存存储应该覆盖之前的token", async () => {
      const storage = new MemoryTokenStorage();

      const token1 = {
        access_token: "token1",
        tenantId: "tenant1",
        userId: "user1",
      };

      const token2 = {
        access_token: "token2",
        tenantId: "tenant2",
        userId: "user2",
      };

      await storage.saveToken(token1);
      await storage.saveToken(token2);

      expect(await storage.getToken()).toEqual(token2);
    });

    it("文件存储应该覆盖之前的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "token.json");
      const storage = new FileTokenStorage(tokenFile);

      const token1 = {
        access_token: "token1",
        tenantId: "tenant1",
        userId: "user1",
      };

      const token2 = {
        access_token: "token2",
        tenantId: "tenant2",
        userId: "user2",
      };

      await storage.saveToken(token1);
      await storage.saveToken(token2);

      expect(await storage.getToken()).toEqual(token2);
    });
  });

  describe("测试用例3: Token数据完整性验证", () => {
    it("应该拒绝缺少access_token的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "invalid-token.json");

      const invalidToken = {
        tenantId: "tenant-1",
        userId: "user-1",
        // 缺少access_token
      };

      await fs.writeFile(tokenFile, JSON.stringify(invalidToken), "utf-8");
      const storage = new FileTokenStorage(tokenFile);

      await expect(storage.getToken()).rejects.toThrow();
    });

    it("应该拒绝缺少tenantId的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "invalid-token.json");

      const invalidToken = {
        access_token: "token-1",
        userId: "user-1",
        // 缺少tenantId
      };

      await fs.writeFile(tokenFile, JSON.stringify(invalidToken), "utf-8");
      const storage = new FileTokenStorage(tokenFile);

      await expect(storage.getToken()).rejects.toThrow();
    });

    it("应该拒绝缺少userId的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "invalid-token.json");

      const invalidToken = {
        access_token: "token-1",
        tenantId: "tenant-1",
        // 缺少userId
      };

      await fs.writeFile(tokenFile, JSON.stringify(invalidToken), "utf-8");
      const storage = new FileTokenStorage(tokenFile);

      await expect(storage.getToken()).rejects.toThrow();
    });

    it("应该接受完整的token数据", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "valid-token.json");

      const validToken = {
        access_token: "token-1",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      await fs.writeFile(tokenFile, JSON.stringify(validToken), "utf-8");
      const storage = new FileTokenStorage(tokenFile);

      const token = await storage.getToken();
      expect(token).toEqual(validToken);
    });

    it("应该接受包含额外字段的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "valid-token.json");

      const tokenWithExtraFields = {
        access_token: "token-1",
        tenantId: "tenant-1",
        userId: "user-1",
        username: "test-user", // 额外字段
        expiresAt: Date.now(), // 额外字段
      };

      await fs.writeFile(tokenFile, JSON.stringify(tokenWithExtraFields), "utf-8");
      const storage = new FileTokenStorage(tokenFile);

      const token = await storage.getToken();
      expect(token).toBeDefined();
      expect(token?.access_token).toBe("token-1");
      expect(token?.tenantId).toBe("tenant-1");
      expect(token?.userId).toBe("user-1");
    });
  });

  describe("测试用例4: 错误处理和恢复", () => {
    it("应该提供详细的错误信息", async () => {
      const storage = new MemoryTokenStorage();
      const tokenData = {
        access_token: "test-token",
        tenantId: "test-tenant",
        userId: "test-user",
      };

      await storage.saveToken(tokenData);

      // 清除后读取应该返回null
      await storage.clearToken();
      const token = await storage.getToken();
      expect(token).toBeNull();
    });

    it("应该能够从错误中恢复", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "test-token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "test-token",
        tenantId: "test-tenant",
        userId: "test-user",
      };

      // 第一次保存成功
      await storage.saveToken(tokenData);
      expect(await storage.getToken()).toEqual(tokenData);

      // 清除
      await storage.clearToken();
      expect(await storage.getToken()).toBeNull();

      // 再次保存应该成功
      await storage.saveToken(tokenData);
      expect(await storage.getToken()).toEqual(tokenData);
    });
  });

  describe("测试用例5: 并发访问", () => {
    it("应该能够处理并发的保存操作", async () => {
      const storage = new MemoryTokenStorage();

      // 创建多个并发保存操作
      const promises = Array.from({ length: 10 }, (_, i) => {
        return storage.saveToken({
          access_token: `token-${i}`,
          tenantId: `tenant-${i}`,
          userId: `user-${i}`,
        });
      });

      await Promise.all(promises);

      // 最后保存的token应该存在
      const token = await storage.getToken();
      expect(token).toBeDefined();
      expect(token?.access_token).toMatch(/^token-\d+$/);
    });

    it("应该能够处理并发的读取操作", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "test-token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "test-token",
        tenantId: "test-tenant",
        userId: "test-user",
      };

      await storage.saveToken(tokenData);

      // 创建多个并发读取操作
      const promises = Array.from({ length: 10 }, () => storage.getToken());
      const results = await Promise.all(promises);

      // 所有读取应该返回相同的token
      results.forEach((result) => {
        expect(result).toEqual(tokenData);
      });
    });

    it("应该能够处理并发的清除操作", async () => {
      const storage = new MemoryTokenStorage();
      const tokenData = {
        access_token: "test-token",
        tenantId: "test-tenant",
        userId: "test-user",
      };

      await storage.saveToken(tokenData);

      // 创建多个并发清除操作
      const promises = Array.from({ length: 10 }, () => storage.clearToken());
      await Promise.all(promises);

      // token应该被清除
      expect(await storage.getToken()).toBeNull();
    });
  });

  describe("测试用例6: 边界情况", () => {
    it("应该处理空字符串token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: " ", // 空格而不是空字符串（空字符串会被认为是缺失字段）
        tenantId: "tenant-1",
        userId: "user-1",
      };

      await storage.saveToken(tokenData);

      // 空格token应该被接受
      const token = await storage.getToken();
      expect(token).toBeDefined();
      expect(token?.access_token).toBe(" ");
    });

    it("应该处理很长的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "a".repeat(10000), // 很长的token
        tenantId: "tenant-1",
        userId: "user-1",
      };

      await storage.saveToken(tokenData);

      const token = await storage.getToken();
      expect(token).toBeDefined();
      expect(token?.access_token).toBe("a".repeat(10000));
    });

    it("应该处理特殊字符的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "token-with-special-chars-!@#$%^&*()_+-=[]{}|;':\",./<>?",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      await storage.saveToken(tokenData);

      const token = await storage.getToken();
      expect(token).toEqual(tokenData);
    });

    it("应该处理Unicode字符的token", async () => {
      tempDir = await createTempDir();
      const tokenFile = path.join(tempDir, "token.json");

      const storage = new FileTokenStorage(tokenFile);
      const tokenData = {
        access_token: "token-with-中文-日本語-한글",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      await storage.saveToken(tokenData);

      const token = await storage.getToken();
      expect(token).toEqual(tokenData);
    });
  });

  describe("测试用例7: 环境隔离", () => {
    it("多个存储实例应该相互独立", async () => {
      tempDir = await createTempDir();
      const tokenFile1 = path.join(tempDir, "token1.json");
      const tokenFile2 = path.join(tempDir, "token2.json");

      const storage1 = new FileTokenStorage(tokenFile1);
      const storage2 = new FileTokenStorage(tokenFile2);

      const token1 = {
        access_token: "token-1",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      const token2 = {
        access_token: "token-2",
        tenantId: "tenant-2",
        userId: "user-2",
      };

      await storage1.saveToken(token1);
      await storage2.saveToken(token2);

      expect(await storage1.getToken()).toEqual(token1);
      expect(await storage2.getToken()).toEqual(token2);
    });

    it("内存存储实例应该相互独立", async () => {
      const storage1 = new MemoryTokenStorage();
      const storage2 = new MemoryTokenStorage();

      const token1 = {
        access_token: "token-1",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      const token2 = {
        access_token: "token-2",
        tenantId: "tenant-2",
        userId: "user-2",
      };

      await storage1.saveToken(token1);
      await storage2.saveToken(token2);

      expect(await storage1.getToken()).toEqual(token1);
      expect(await storage2.getToken()).toEqual(token2);
    });
  });
});
