# Gildata Provider 实施计划

**创建时间**: 2026-04-15
**作者**: 胡丹
**优先级**: 高

## 概述

本计划用于完善 Gildata Provider 插件的 6 个关键步骤，解决当前存在的构建问题、Token 持久化、错误处理、日志记录、性能监控和 E2E 测试等问题。

---

## Step 1: 修复构建配置

### 问题诊断
- **当前状态**: gildata 扩展无法通过 `pnpm build` 构建
- **错误信息**: `Cannot resolve entry module extensions/gildata/index.ts`
- **根本原因**: `package.json` 中的 `extensions: ["./index.ts"]` 指向了不存在的文件
- **实际位置**: 入口文件位于 `extensions/gildata/src/index.ts`

### 解决方案

#### 选项 A: 移动入口文件到根目录（推荐）
**理由**: 与其他扩展（google, openrouter 等）保持一致的文件结构

**操作步骤**:
1. 将 `extensions/gildata/src/index.ts` 移动到 `extensions/gildata/index.ts`
2. 更新 `extensions/gildata/src/index.test.ts` 中的引用
3. 验证构建成功

**风险**: 低
- 需要更新相对导入路径
- 测试文件可能需要调整

#### 选项 B: 更新 package.json 引用
**理由**: 保持当前文件结构，只更新配置

**操作步骤**:
1. 将 `extensions/gildata/package.json` 中的 `"./index.ts"` 改为 `"./src/index.ts"`
2. 验证构建成功

**风险**: 低
- 可能影响插件发现机制
- 需要与其他扩展保持一致

### 文件清单
- `extensions/gildata/package.json`
- `extensions/gildata/index.ts` (新建)
- `extensions/gildata/src/index.ts` (删除或移动)

### 验证标准
```bash
pnpm build  # 应该成功，无 gildata 相关错误
```

---

## Step 2: 添加 Token 持久化

### 问题诊断
- **当前状态**: Token 存储在内存中（`MemoryTokenStorage`），重启后丢失
- **影响**: 每次重启都需要重新登录，用户体验差
- **代码位置**: `extensions/gildata/src/warrenq-login.ts:40-54`

### 解决方案

#### 实现 FileTokenStorage
创建基于文件系统的持久化存储，将 Token 保存到 `~/.openclaw/credentials/` 目录。

**操作步骤**:
1. 创建 `extensions/gildata/src/token-storage.ts`
   - 定义 `TokenStorage` 接口
   - 实现 `MemoryTokenStorage`（现有）
   - 实现 `FileTokenStorage`（新增）
2. 修改 `warrenq-login.ts` 使用 `FileTokenStorage`
3. 添加加密支持（可选，使用 `node:crypto`）
4. 处理文件系统错误

### 文件清单
- `extensions/gildata/src/token-storage.ts` (新建)
- `extensions/gildata/src/warrenq-login.ts` (修改)

### 验证标准
```typescript
// 测试 Token 持久化
const storage = new FileTokenStorage();
storage.saveToken(tenantInfo);
// 重启应用后
const token = storage.getToken();
expect(token).toEqual(tenantInfo);
```

---

## Step 3: 增强错误处理

### 问题诊断
- **当前状态**: 错误处理不够完善，用户体验差
- **问题**:
  - 登录失败时只有简单错误消息
  - API 调用错误缺少详细上下文
  - 没有重试机制
- **影响**: 调试困难，用户无法理解错误原因

### 解决方案

#### 实现结构化错误处理
创建自定义错误类和错误码，提供清晰的错误消息和恢复建议。

**操作步骤**:
1. 创建 `extensions/gildata/src/errors.ts`
   - 定义 `GildataError` 基类
   - 定义具体错误类型（认证错误、网络错误、配置错误等）
   - 实现错误码和用户友好消息
2. 添加重试机制
   - 使用指数退避策略
   - 对网络错误和临时故障进行重试
3. 更新所有 API 调用使用结构化错误
4. 添加错误恢复建议

### 文件清单
- `extensions/gildata/src/errors.ts` (新建)
- `extensions/gildata/src/api.ts` (修改)
- `extensions/gildata/src/warrenq-login.ts` (修改)
- `extensions/gildata/src/dynamic-models.ts` (修改)

### 验证标准
```typescript
// 测试错误处理
try {
  await fetchGildataModels({ baseUrl, apiKey: "invalid" });
} catch (error) {
  expect(error).toBeInstanceOf(GildataAuthenticationError);
  expect(error.message).toContain("API key");
  expect(error.recoveryAction).toBeDefined();
}
```

---

## Step 4: 添加日志记录

### 问题诊断
- **当前状态**: 使用 `console.log` 进行调试
- **问题**:
  - 日志结构不统一
  - 没有日志级别
  - 缺少关键操作的日志记录
  - 无法跟踪完整的请求流程
- **影响**: 调试困难，问题定位慢

### 解决方案

#### 实现结构化日志
使用 OpenClaw 的日志系统（如果可用）或集成 `tslog`（项目已依赖）。

**操作步骤**:
1. 创建 `extensions/gildata/src/logger.ts`
   - 初始化 logger 实例
   - 定义日志级别（debug, info, warn, error）
   - 添加请求 ID 和上下文跟踪
2. 在关键操作点添加日志：
   - 登录流程（开始、成功、失败）
   - API 调用（请求、响应、错误）
   - Token 获取和验证
   - 模型列表获取
3. 移除所有 `console.log` 调用
4. 添加性能日志（请求耗时）

### 文件清单
- `extensions/gildata/src/logger.ts` (新建)
- `extensions/gildata/src/api.ts` (修改)
- `extensions/gildata/src/warrenq-login.ts` (修改)
- `extensions/gildata/src/dynamic-models.ts` (修改)

### 验证标准
```typescript
// 测试日志记录
logger.info("Gildata provider initialized");
logger.debug("Fetching models", { baseUrl, apiKey: "***" });
logger.warn("Token expired", { userId, tenantId });
logger.error("Login failed", { error, username });
```

---

## Step 5: 性能监控

### 问题诊断
- **当前状态**: 没有请求缓存和超时处理
- **问题**:
  - 重复请求未缓存
  - 没有超时保护
  - 无法监控性能指标
- **影响**: 响应慢，资源浪费，无法优化

### 解决方案

#### 实现请求缓存和超时
使用内存缓存（LRU）和超时控制。

**操作步骤**:
1. 创建 `extensions/gildata/src/cache.ts`
   - 实现 LRU 缓存
   - 设置 TTL（Time To Live）
   - 添加缓存统计（命中率、未命中率）
2. 添加超时处理
   - 为所有 API 调用设置默认超时（30s）
   - 支持自定义超时配置
   - 超时后抛出明确的错误
3. 添加性能监控
   - 记录请求耗时
   - 统计 API 调用次数
   - 跟踪错误率

### 文件清单
- `extensions/gildata/src/cache.ts` (新建)
- `extensions/gildata/src/api.ts` (修改)
- `extensions/gildata/src/dynamic-models.ts` (修改)

### 验证标准
```typescript
// 测试缓存
const cache = new LRUCache<string, Model[]>({ max: 100, ttl: 60000 });
cache.set("models", models);
const cached = cache.get("models");
expect(cached).toEqual(models);

// 测试超时
await expect(fetchGildataModels({ timeoutMs: 100 })).rejects.toThrow(TimeoutError);
```

---

## Step 6: E2E 测试

### 问题诊断
- **当前状态**: 只有单元测试，缺少 E2E 测试
- **问题**:
  - 无法测试完整的用户流程
  - 集成问题难以发现
  - 缺少回归测试保护
- **影响**: 质量保证不足，发布风险高

### 解决方案

#### 实现 E2E 测试套件
使用 Playwright（项目已配置）测试关键用户流程。

**操作步骤**:
1. 创建 `extensions/gildata/e2e/` 目录
2. 编写 E2E 测试用例：
   - warrenq 登录流程
   - API Key 认证流程
   - 模型列表获取
   - Token 持久化验证
   - 错误恢复场景
3. 设置测试环境：
   - Mock API 服务器
   - 测试凭据管理
   - 测试数据清理
4. 集成到 CI/CD 流程

### 文件清单
- `extensions/gildata/e2e/login-flow.test.ts` (新建)
- `extensions/gildata/e2e/api-key-auth.test.ts` (新建)
- `extensions/gildata/e2e/model-discovery.test.ts` (新建)
- `extensions/gildata/e2e/token-persistence.test.ts` (新建)
- `extensions/gildata/e2e/error-recovery.test.ts` (新建)

### 验证标准
```bash
# 运行 E2E 测试
pnpm test:e2e extensions/gildata

# 应该全部通过
```

---

## 优先级建议

基于风险和影响，建议按以下顺序实施：

### 高优先级（立即实施）
1. **Step 1: 修复构建配置** - 阻塞问题，必须首先解决
2. **Step 2: 添加 Token 持久化** - 严重影响用户体验

### 中优先级（短期实施）
3. **Step 3: 增强错误处理** - 提高可维护性
4. **Step 4: 添加日志记录** - 便于调试和监控

### 低优先级（长期实施）
5. **Step 5: 性能监控** - 优化性能，但不是阻塞项
6. **Step 6: E2E 测试** - 提高质量，但可以先手动验证

---

## 风险评估

| 步骤 | 风险等级 | 缓解措施 |
|------|---------|---------|
| Step 1 | 低 | 参考其他扩展的结构，保持一致性 |
| Step 2 | 中 | 使用加密保护敏感数据，处理文件系统错误 |
| Step 3 | 低 | 保持向后兼容，逐步迁移 |
| Step 4 | 低 | 遵循项目日志规范，使用现有依赖 |
| Step 5 | 低 | 先实现基本功能，后续优化 |
| Step 6 | 中 | 使用 Mock 服务器，避免依赖外部服务 |

---

## 实施检查清单

### Step 1: 修复构建配置
- [ ] 确定文件结构方案
- [ ] 移动或创建入口文件
- [ ] 更新 package.json
- [ ] 更新测试引用
- [ ] 验证构建成功
- [ ] 更新文档

### Step 2: 添加 Token 持久化
- [ ] 创建 token-storage.ts
- [ ] 实现 FileTokenStorage
- [ ] 集成到现有代码
- [ ] 添加单元测试
- [ ] 手动测试持久化
- [ ] 处理错误场景

### Step 3: 增强错误处理
- [ ] 创建 errors.ts
- [ ] 定义错误类型和错误码
- [ ] 实现重试机制
- [ ] 更新 API 调用
- [ ] 添加错误测试
- [ ] 更新用户文档

### Step 4: 添加日志记录
- [ ] 创建 logger.ts
- [ ] 定义日志级别
- [ ] 在关键点添加日志
- [ ] 移除 console.log
- [ ] 添加性能日志
- [ ] 测试日志输出

### Step 5: 性能监控
- [ ] 创建 cache.ts
- [ ] 实现 LRU 缓存
- [ ] 添加超时处理
- [ ] 实现性能监控
- [ ] 添加缓存测试
- [ ] 测试超时场景

### Step 6: E2E 测试
- [ ] 创建 e2e 目录
- [ ] 编写登录流程测试
- [ ] 编写 API Key 认证测试
- [ ] 编写模型发现测试
- [ ] 编写 Token 持久化测试
- [ ] 编写错误恢复测试
- [ ] 集成到 CI/CD

---

## 参考资料

- [OpenClaw Plugin SDK 文档](/docs/plugins/sdk-overview.md)
- [Provider Plugin 架构](/docs/plugins/sdk-provider-plugins.md)
- [测试指南](/docs/help/testing.md)
- [代码规范](/docs/AGENTS.md)
- [其他扩展示例](extensions/google/, extensions/openrouter/)
