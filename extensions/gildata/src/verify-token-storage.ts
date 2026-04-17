#!/usr/bin/env node

import { FileTokenStorage, MemoryTokenStorage } from "./warrenq-login.js";
import * as path from "path";
import * as os from "os";

async function testFileTokenStorage() {
  console.log("=== 测试 FileTokenStorage ===\n");

  const tempDir = path.join(os.tmpdir(), `gildata-token-test-${Date.now()}`);
  const testPath = path.join(tempDir, "test-token.json");
  const storage = new FileTokenStorage(testPath);

  try {
    // 测试1: 保存token
    console.log("1. 测试保存token...");
    const tokenData = {
      access_token: "test-access-token-12345",
      tenantId: "tenant-abc-67890",
      userId: "user-xyz-24680",
    };
    await storage.saveToken(tokenData);
    console.log("   ✓ Token保存成功\n");

    // 测试2: 读取token
    console.log("2. 测试读取token...");
    const retrieved = await storage.getToken();
    if (retrieved?.access_token === tokenData.access_token &&
        retrieved?.tenantId === tokenData.tenantId &&
        retrieved?.userId === tokenData.userId) {
      console.log("   ✓ Token读取成功，数据匹配\n");
    } else {
      console.error("   ✗ Token读取失败，数据不匹配");
      console.error("   预期:", tokenData);
      console.error("   实际:", retrieved);
      process.exit(1);
    }

    // 测试3: 清除token
    console.log("3. 测试清除token...");
    await storage.clearToken();
    const afterClear = await storage.getToken();
    if (afterClear === null) {
      console.log("   ✓ Token清除成功\n");
    } else {
      console.error("   ✗ Token清除失败");
      process.exit(1);
    }

    // 测试4: 读取不存在的token
    console.log("4. 测试读取不存在的token...");
    const nonExistent = await storage.getToken();
    if (nonExistent === null) {
      console.log("   ✓ 正确返回null\n");
    } else {
      console.error("   ✗ 应该返回null");
      process.exit(1);
    }

    console.log("=== FileTokenStorage 所有测试通过 ✓ ===\n");
  } catch (error) {
    console.error("✗ FileTokenStorage 测试失败:", error);
    process.exit(1);
  }
}

async function testMemoryTokenStorage() {
  console.log("=== 测试 MemoryTokenStorage ===\n");

  const storage = new MemoryTokenStorage();

  try {
    // 测试1: 初始状态
    console.log("1. 测试初始状态...");
    const initial = await storage.getToken();
    if (initial === null) {
      console.log("   ✓ 初始状态为null\n");
    } else {
      console.error("   ✗ 初始状态应该为null");
      process.exit(1);
    }

    // 测试2: 保存和读取
    console.log("2. 测试保存和读取...");
    const tokenData = {
      access_token: "memory-token-test",
      tenantId: "tenant-memory",
      userId: "user-memory",
    };
    await storage.saveToken(tokenData);
    const retrieved = await storage.getToken();
    if (retrieved?.access_token === tokenData.access_token) {
      console.log("   ✓ 保存和读取成功\n");
    } else {
      console.error("   ✗ 数据不匹配");
      process.exit(1);
    }

    // 测试3: 清除
    console.log("3. 测试清除...");
    await storage.clearToken();
    const afterClear = await storage.getToken();
    if (afterClear === null) {
      console.log("   ✓ 清除成功\n");
    } else {
      console.error("   ✗ 清除失败");
      process.exit(1);
    }

    // 测试4: 实例隔离
    console.log("4. 测试实例隔离...");
    const storage1 = new MemoryTokenStorage();
    const storage2 = new MemoryTokenStorage();
    await storage1.saveToken(tokenData);
    const s1Token = await storage1.getToken();
    const s2Token = await storage2.getToken();
    if (s1Token !== null && s2Token === null) {
      console.log("   ✓ 实例之间正确隔离\n");
    } else {
      console.error("   ✗ 实例未正确隔离");
      process.exit(1);
    }

    console.log("=== MemoryTokenStorage 所有测试通过 ✓ ===\n");
  } catch (error) {
    console.error("✗ MemoryTokenStorage 测试失败:", error);
    process.exit(1);
  }
}

async function main() {
  console.log("\n========================================");
  console.log("warrenq Token存储功能验证");
  console.log("========================================\n");

  await testFileTokenStorage();
  await testMemoryTokenStorage();

  console.log("========================================");
  console.log("所有测试通过！Token存储功能正常工作 ✓");
  console.log("========================================\n");

  console.log("存储机制说明:");
  console.log("- FileTokenStorage: 将token持久化到文件 (~/.openclaw/gildata-token.json)");
  console.log("- MemoryTokenStorage: 将token存储在内存中（用于测试）");
  console.log("- 默认使用: FileTokenStorage（生产环境）");
  console.log("- 支持依赖注入: warrenqLoginClient构造函数可指定存储实现\n");
}

main().catch(error => {
  console.error("主程序出错:", error);
  process.exit(1);
});
