import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";
import { FileTokenStorage, MemoryTokenStorage } from "./warrenq-login.js";

describe("FileTokenStorage", () => {
  let storage: FileTokenStorage;
  let testDir: string;
  let testTokenPath: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "gildata-token-test-"));
    testTokenPath = path.join(testDir, "gildata-token.json");
    storage = new FileTokenStorage(testTokenPath);
  });

  afterEach(async () => {
    // 清理临时目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  it("should save token to file", async () => {
    const tokenData = {
      access_token: "test-token-123",
      tenantId: "tenant-456",
      userId: "user-789",
    };

    await storage.saveToken(tokenData);

    // 验证文件存在
    const fileExists = await fs.access(testTokenPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // 验证文件内容
    const content = await fs.readFile(testTokenPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.access_token).toBe("test-token-123");
    expect(parsed.tenantId).toBe("tenant-456");
    expect(parsed.userId).toBe("user-789");
  });

  it("should read token from file", async () => {
    const tokenData = {
      access_token: "test-token-abc",
      tenantId: "tenant-def",
      userId: "user-ghi",
    };

    await storage.saveToken(tokenData);
    const retrieved = await storage.getToken();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.access_token).toBe("test-token-abc");
    expect(retrieved?.tenantId).toBe("tenant-def");
    expect(retrieved?.userId).toBe("user-ghi");
  });

  it("should return null when file does not exist", async () => {
    const retrieved = await storage.getToken();
    expect(retrieved).toBeNull();
  });

  it("should clear token file", async () => {
    const tokenData = {
      access_token: "test-token",
      tenantId: "tenant",
      userId: "user",
    };

    await storage.saveToken(tokenData);

    // 验证文件存在
    let fileExists = await fs.access(testTokenPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // 清除token
    await storage.clearToken();

    // 验证文件不存在
    fileExists = await fs.access(testTokenPath).then(() => true).catch(() => false);
    expect(fileExists).toBe(false);
  });

  it("should throw error for invalid token structure", async () => {
    // 写入无效的token结构
    await fs.writeFile(testTokenPath, JSON.stringify({ invalid: "data" }));

    await expect(storage.getToken()).rejects.toThrow("Token结构无效，缺少必需字段");
  });

  it("should handle concurrent save and read", async () => {
    const tokenData = {
      access_token: "concurrent-token",
      tenantId: "tenant",
      userId: "user",
    };

    // 并发保存和读取
    const [saveResult, readResult] = await Promise.allSettled([
      storage.saveToken(tokenData),
      storage.getToken(),
    ]);

    expect(saveResult.status).toBe("fulfilled");
    // 第一次读取可能为null（因为文件还不存在）
    expect(readResult.status).toBe("fulfilled");
  });

  it("should overwrite existing token", async () => {
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

    await storage.saveToken(token1);
    await storage.saveToken(token2);

    const retrieved = await storage.getToken();
    expect(retrieved?.access_token).toBe("token-2");
    expect(retrieved?.tenantId).toBe("tenant-2");
    expect(retrieved?.userId).toBe("user-2");
  });
});

describe("MemoryTokenStorage", () => {
  let storage: MemoryTokenStorage;

  beforeEach(() => {
    storage = new MemoryTokenStorage();
  });

  it("should save token in memory", async () => {
    const tokenData = {
      access_token: "memory-token",
      tenantId: "tenant",
      userId: "user",
    };

    await storage.saveToken(tokenData);
    const retrieved = await storage.getToken();

    expect(retrieved).not.toBeNull();
    expect(retrieved?.access_token).toBe("memory-token");
  });

  it("should return null initially", async () => {
    const retrieved = await storage.getToken();
    expect(retrieved).toBeNull();
  });

  it("should clear token", async () => {
    const tokenData = {
      access_token: "token",
      tenantId: "tenant",
      userId: "user",
    };

    await storage.saveToken(tokenData);
    await storage.clearToken();

    const retrieved = await storage.getToken();
    expect(retrieved).toBeNull();
  });

  it("should not share state between instances", async () => {
    const storage1 = new MemoryTokenStorage();
    const storage2 = new MemoryTokenStorage();

    const tokenData = {
      access_token: "token",
      tenantId: "tenant",
      userId: "user",
    };

    await storage1.saveToken(tokenData);

    const retrieved1 = await storage1.getToken();
    const retrieved2 = await storage2.getToken();

    expect(retrieved1).not.toBeNull();
    expect(retrieved2).toBeNull();
  });
});
