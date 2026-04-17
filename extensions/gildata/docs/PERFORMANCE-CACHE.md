# warrenq 性能监控和缓存机制

## 概述

为warrenq认证流程添加了完整的性能监控和缓存机制，提升了系统的可观测性和响应速度。

## 功能特性

### 1. 性能监控 (Performance Monitor)

**功能：**
- 记录API请求的响应时间
- 追踪token获取时间
- 监控认证流程总耗时
- 统计请求成功率
- 计算延迟指标（P50/P95/P99）

**使用示例：**

```typescript
import { performanceMonitor } from "./performance-monitor.js";

// 创建计时器
const timer = performanceMonitor.createTimer();

// 执行操作
const result = await someAsyncOperation();

// 停止计时并记录
const elapsed = timer.stop();
performanceMonitor.recordSuccess(elapsed, "api");

// 获取性能摘要
const summary = performanceMonitor.getSummary();
console.log(`成功率: ${summary.successRate}%`);
console.log(`P95延迟: ${summary.p95Latency}ms`);

// 格式化输出
console.log(performanceMonitor.formatSummary());
```

**性能指标说明：**

| 指标 | 说明 |
|------|------|
| `totalRequests` | 总请求数 |
| `successfulRequests` | 成功请求数 |
| `failedRequests` | 失败请求数 |
| `successRate` | 请求成功率（百分比） |
| `averageResponseTime` | 平均响应时间（毫秒） |
| `minResponseTime` | 最小响应时间（毫秒） |
| `maxResponseTime` | 最大响应时间（毫秒） |
| `p50Latency` | 50%请求的响应时间（中位数） |
| `p95Latency` | 95%请求的响应时间 |
| `p99Latency` | 99%请求的响应时间 |

### 2. 缓存管理 (Cache Manager)

**功能：**
- 缓存租户信息（TTL: 1小时）
- 缓存模型列表（TTL: 24小时）
- 提供缓存失效接口
- 缓存命中率统计
- 支持配置禁用缓存
- **不缓存敏感信息**（token、密码）

**使用示例：**

```typescript
import { cacheManager } from "./cache-manager.js";
import type { warrenqTenantInfo } from "./warrenq-login.js";

// 缓存租户信息
const tenantInfo: warrenqTenantInfo = {
  tenantId: "tenant123",
  userId: "user123",
  access_token: "token123",
};
cacheManager.setTenantInfo(tenantInfo);

// 获取缓存
const cached = cache.getTenantInfo("user123");
if (cached) {
  console.log(`缓存命中: ${cached.tenantId}`);
}

// 获取缓存统计
const stats = cacheManager.getStats();
console.log(`缓存命中率: ${stats.hitRate}%`);

// 失效缓存
cacheManager.invalidateTenantInfo("user123");
cacheManager.invalidateModelList();
cacheManager.invalidateAll();

// 更新配置
cacheManager.updateConfig({
  enabled: false, // 禁用缓存
  tenantInfoTtl: 30 * 60 * 1000, // 30分钟
});

// 格式化输出
console.log(cacheManager.formatStats());
```

**缓存配置说明：**

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enabled` | `true` | 是否启用缓存 |
| `tenantInfoTtl` | `3600000` (1小时) | 租户信息TTL（毫秒） |
| `modelListTtl` | `86400000` (24小时) | 模型列表TTL（毫秒） |
| `maxCacheSize` | `100` | 最大缓存项数 |

**安全注意事项：**

- ✅ 缓存租户ID和用户ID
- ❌ 不缓存access_token
- ❌ 不缓存用户密码
- ❌ 不缓存任何敏感信息

### 3. HTTP客户端 (HTTP Client)

**功能：**
- 支持请求超时
- 自动取消超时请求
- 与性能监控集成

**使用示例：**

```typescript
import {
  loginRequest,
  tenantInfoRequest,
  apiRequest,
  fetchWithTimeout,
} from "./http-client.js";

// 登录请求（30秒超时）
const loginResponse = await loginRequest(
  "https://api.warrenq.com/login",
  formData
);

// 租户信息请求（15秒超时）
const tenantResponse = await tenantInfoRequest(
  "https://api.warrenq.com/tenant",
  jsonBody
);

// API请求（60秒超时）
const apiResponse = await apiRequest(
  "https://api.warrenq.com/api",
  jsonBody
);

// 自定义超时
const customResponse = await fetchWithTimeout(url, {
  timeout: 10000, // 10秒超时
  method: "POST",
  body: jsonBody,
});
```

**超时配置说明：**

| 请求类型 | 超时时间 | 说明 |
|----------|----------|------|
| `loginRequest` | 30秒 | 登录请求 |
| `tenantInfoRequest` | 15秒 | 获取租户信息 |
| `apiRequest` | 60秒 | API调用 |
| `fetchWithTimeout` | 可配置 | 默认60秒 |

## 性能指标示例

### 性能监控示例输出

```
性能监控摘要
==============
总请求数: 150
成功: 145 | 失败: 5
成功率: 96.67%

响应时间（毫秒）:
  平均: 234.56
  最小: 45
  最大: 1250

延迟百分位数:
  P50: 180.00ms
  P95: 450.00ms
  P99: 850.00ms

分类统计:
  登录请求: 5 (平均: 450.00ms)
  租户信息请求: 10 (平均: 120.00ms)
  API请求: 135 (平均: 220.00ms)
```

### 缓存统计示例输出

```
缓存统计信息
==========
总缓存项数: 15
租户信息项: 10
模型列表项: 5

命中率:
  命中: 120
  未命中: 30
  命中率: 80.00%

缓存状态: 启用
租户信息TTL: 60 分钟
模型列表TTL: 24 小时
最大缓存大小: 100
```

## 缓存策略说明

### 缓存层级

1. **租户信息缓存**
   - 存储内容：tenantId, userId（不包含token）
   - TTL: 1小时
   - 用途：减少重复的租户信息查询

2. **模型列表缓存**
   - 存储内容：完整的模型列表
   - TTL: 24小时
   - 用途：减少模型列表API调用

### 缓存失效策略

1. **TTL过期**
   - 缓存项在达到TTL后自动失效
   - 下次访问时返回null

2. **手动失效**
   - `invalidateTenantInfo(userId)` - 失效特定租户
   - `invalidateModelList()` - 失效模型列表
   - `invalidateAll()` - 失效所有缓存

3. **缓存清理**
   - 定期清理过期项（`cleanupExpired()`）
   - 达到最大缓存大小时，删除最久未使用的项

### 缓存命中率优化

- 高命中率（>80%）：缓存配置合理
- 中命中率（50-80%）：可能需要调整TTL
- 低命中率（<50%）：考虑禁用缓存或优化缓存策略

## 集成到现有代码

### 在warrenq-login.ts中的集成

```typescript
import { performanceMonitor } from "./performance-monitor.js";
import { cacheManager } from "./cache-manager.js";
import { loginRequest, tenantInfoRequest } from "./http-client.js";

// 登录方法已集成性能监控和超时处理
async login(username: string, password: string) {
  // 自动记录响应时间和超时控制
  const response = await loginRequest(url, formData);
  // ...
}

// 租户信息方法已集成缓存
async getTenantInfo(token: string) {
  // 自动缓存租户信息（不含token）
  cacheManager.setTenantInfo(tenantInfo);
  // ...
}
```

### 查看性能和缓存统计

```typescript
// 在适当的时候输出性能和缓存统计
console.log(performanceMonitor.formatSummary());
console.log(cacheManager.formatStats());

// 或者重置指标以开始新的统计周期
performanceMonitor.reset();
cacheManager.invalidateAll();
```

## 配置建议

### 生产环境配置

```typescript
const cacheManager = new CacheManager({
  enabled: true,
  tenantInfoTtl: 60 * 60 * 1000,      // 1小时
  modelListTtl: 24 * 60 * 60 * 1000,   // 24小时
  maxCacheSize: 1000,                  // 更大的缓存
});
```

### 开发环境配置

```typescript
const cacheManager = new CacheManager({
  enabled: true,
  tenantInfoTtl: 5 * 60 * 1000,       // 5分钟（便于测试）
  modelListTtl: 30 * 60 * 1000,        // 30分钟
  maxCacheSize: 100,                    // 较小的缓存
});
```

### 禁用缓存

```typescript
const cacheManager = new CacheManager({
  enabled: false,  // 完全禁用缓存
});
```

## 测试

运行性能监控和缓存测试：

```bash
# 运行所有测试
pnpm test performance-cache.test.ts

# 运行测试并查看覆盖率
pnpm test:coverage performance-cache.test.ts
```

## 最佳实践

1. **定期查看性能指标**
   - 关注P95和P99延迟
   - 监控请求成功率
   - 识别性能瓶颈

2. **根据使用场景调整TTL**
   - 频繁变化的数据：短TTL
   - 稳定的数据：长TTL
   - 敏感数据：不缓存

3. **合理设置缓存大小**
   - 根据内存限制调整
   - 避免缓存过多过期数据
   - 定期清理缓存

4. **监控缓存命中率**
   - 高命中率：缓存有效
   - 低命中率：优化缓存策略
   - 考虑禁用无效缓存

5. **性能优化建议**
   - 使用缓存减少API调用
   - 设置合理的超时时间
   - 监控和优化慢查询
   - 使用异步操作避免阻塞

## 故障排查

### 问题：缓存未命中率高

**可能原因：**
- TTL设置过短
- 缓存键不正确
- 缓存被频繁清理

**解决方案：**
- 增加TTL时间
- 检查缓存键生成逻辑
- 增加maxCacheSize

### 问题：性能监控显示高延迟

**可能原因：**
- 网络延迟高
- API响应慢
- 超时设置不合理

**解决方案：**
- 检查网络连接
- 优化API查询
- 调整超时配置

### 问题：内存使用过高

**可能原因：**
- 缓存项过多
- 缓存对象过大
- 未及时清理过期缓存

**解决方案：**
- 减少maxCacheSize
- 缩短TTL
- 定期调用cleanupExpired()

## 总结

通过引入性能监控和缓存机制，warrenq认证流程现在具有：

✅ **完整的性能可观测性** - 详细的性能指标和统计数据
✅ **智能的缓存策略** - 自动缓存常用数据，提升响应速度
✅ **可靠的超时处理** - 防止请求无限期挂起
✅ **安全的缓存实践** - 不缓存敏感信息
✅ **灵活的配置选项** - 根据场景调整缓存和超时参数

这些改进显著提升了系统的性能、可靠性和可维护性。
