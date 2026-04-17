# Gildata Provider 日志系统文档

## 概述

Gildata Provider 包含一个结构化日志系统，用于记录认证流程和API调用，便于在生产环境中调试和监控。

## 特性

- **结构化日志输出**：JSON格式，易于解析和分析
- **多级别日志**：debug、info、warn、error
- **敏感数据脱敏**：自动脱敏密码、token、API密钥等敏感信息
- **关联ID跟踪**：支持请求链追踪
- **灵活配置**：支持环境变量和运行时配置
- **兼容OpenClaw**：与OpenClaw现有日志系统集成

## 日志级别

| 级别 | 用途 | 示例场景 |
|------|------|----------|
| `debug` | 详细调试信息 | API请求/响应详情 |
| `info` | 一般信息流 | 认证成功、模型发现 |
| `warn` | 警告信息 | API失败、配置缺失 |
| `error` | 错误信息 | 异常、认证失败 |

## 配置选项

### 环境变量

```bash
# 启用/禁用日志（默认：true）
GILDATA_LOG_ENABLED=true

# 设置日志级别（默认：info）
GILDATA_LOG_LEVEL=debug|info|warn|error

# 启用控制台输出（默认：false）
GILDATA_LOG_CONSOLE=true

# 日志文件路径（可选）
GILDATA_LOG_FILE=/path/to/gildata.log
```

### 运行时配置

```typescript
import { setLoggerConfig } from "./logger.js";

// 设置日志配置
setLoggerConfig({
  level: "debug",
  enabled: true,
  includeCorrelationId: true,
  logToFile: true,
  logToConsole: true,
  filePath: "/var/log/gildata.log",
});
```

## 使用示例

### 基础日志

```typescript
import { logger } from "./logger.js";

// Debug日志
logger.debug("调试信息", { key: "value" });

// Info日志
logger.info("操作完成", { userId: "123", status: "success" });

// Warn日志
logger.warn("警告信息", { code: 404 }, new Error("Not found"));

// Error日志
logger.error("操作失败", error, { context: "api_call" });
```

### API请求/响应日志

```typescript
import { logger, generateCorrelationId } from "./logger.js";

const correlationId = generateCorrelationId();

// 记录API请求
logger.apiRequest({
  method: "POST",
  url: "https://api.gildata.com/v1/chat",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer token...",
  },
  body: { message: "Hello" },
  correlationId,
});

// 记录API响应
logger.apiResponse({
  status: 200,
  headers: { "content-type": "application/json" },
  body: { result: "success" },
  correlationId,
  duration: 123,
});
```

### 认证事件日志

```typescript
import { logger, AuthEventType } from "./logger.js";

// 记录登录尝试
logger.authEvent({
  eventType: AuthEventType.LOGIN_ATTEMPT,
  username: "user123", // 会自动脱敏
  success: true,
  correlationId,
});

// 记录token刷新
logger.authEvent({
  eventType: AuthEventType.TOKEN_REFRESH,
  userId: "user-123",
  success: true,
  correlationId,
});
```

### 使用关联ID

```typescript
import { logger } from "./logger.js";

// 创建带有固定correlationId的子logger
const childLogger = logger.withCorrelationId("req-123456");

// 所有日志都会自动包含correlationId
childLogger.info("开始处理请求");
childLogger.debug("处理数据", { count: 10 });
childLogger.info("请求处理完成");

// 获取当前的correlationId
console.log(childLogger.getCorrelationId()); // "req-123456"
```

## 日志输出格式

### JSON格式（文件日志）

```json
{
  "timestamp": "2026-04-15T14:30:00.000Z",
  "level": "info",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1713195000000-abc123",
  "message": "开始获取Gildata模型列表",
  "data": {
    "baseUrl": "https://api.gildata.com",
    "timeoutMs": 10000,
    "hasApiKey": true,
    "hasCustomHeaders": false
  }
}
```

### 控制台格式

```
[2026-04-15T14:30:00.000Z] [INFO] [gildata-provider] [gildata-1713195000000-abc123] 开始获取Gildata模型列表
Data: {
  "baseUrl": "https://api.gildata.com",
  "timeoutMs": 10000,
  "hasApiKey": true,
  "hasCustomHeaders": false
}
```

## 敏感数据脱敏

系统会自动脱敏以下敏感字段：

- `password`、`passwd`、`pwd`
- `token`、`access_token`、`refresh_token`
- `apiKey`、`api_key`、`api-token`
- `Authorization` 头部
- `private_key`、`privateKey`
- 环境变量：`GILDATA_API_TOKEN`、`warrenq_PASSWORD`

### 脱敏示例

**原始数据：**
```json
{
  "username": "john.doe",
  "password": "secret123",
  "apiKey": "sk-proj-1234567890"
}
```

**脱敏后：**
```json
{
  "username": "j***e",
  "password": "[REDACTED]",
  "apiKey": "[REDACTED]"
}
```

## 日志场景示例

### 1. 用户登录流程

```json
{
  "timestamp": "2026-04-15T14:30:00.000Z",
  "level": "info",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1713195000000-abc123",
  "message": "Auth Event: login_attempt",
  "data": {
    "eventType": "login_attempt",
    "username": "u***5",
    "success": true
  }
}
```

### 2. API请求

```json
{
  "timestamp": "2026-04-15T14:30:01.000Z",
  "level": "debug",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1713195000000-abc123",
  "message": "API Request",
  "data": {
    "method": "GET",
    "url": "https://api.gildata.com/v1/models",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "[REDACTED]"
    }
  }
}
```

### 3. API响应

```json
{
  "timestamp": "2026-04-15T14:30:02.000Z",
  "level": "debug",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1713195000000-abc123",
  "message": "API Response",
  "data": {
    "status": 200,
    "duration": 1000,
    "headers": {
      "content-type": "application/json"
    }
  }
}
```

### 4. 错误情况

```json
{
  "timestamp": "2026-04-15T14:30:03.000Z",
  "level": "error",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1713195000000-abc123",
  "message": "获取模型列表时发生异常",
  "data": {
    "error": "Network timeout"
  },
  "error": {
    "message": "ETIMEDOUT",
    "stack": "Error: ETIMEDOUT\n    at Connection..."
  }
}
```

## 启用详细日志

### 开发环境

```bash
# 启用debug级别日志和控制台输出
export GILDATA_LOG_LEVEL=debug
export GILDATA_LOG_CONSOLE=true

# 运行应用
openclaw ...
```

### 生产环境

```bash
# 只启用warn及以上级别的日志
export GILDATA_LOG_LEVEL=warn
export GILDATA_LOG_CONSOLE=false

# 设置日志文件
export GILDATA_LOG_FILE=/var/log/openclaw/gildata.log

# 运行应用
openclaw ...
```

## 日志分析

### 使用jq分析日志

```bash
# 查看所有错误日志
cat gildata.log | jq 'select(.level == "error")'

# 查看特定correlationId的所有日志
cat gildata.log | jq 'select(.correlationId == "gildata-1713195000000-abc123")'

# 统计各级别日志数量
cat gildata.log | jq -r '.level' | sort | uniq -c
```

### 使用grep快速搜索

```bash
# 搜索错误日志
grep '"level":"error"' gildata.log

# 搜索特定API调用
grep '"method":"GET"' gildata.log | grep '"/v1/models"'
```

## 性能考虑

- 日志默认不会影响性能
- 在生产环境中建议使用`info`或`warn`级别
- 避免在循环中记录大量debug日志
- 大日志文件会自动轮转（默认24小时）

## 故障排查

### 日志没有输出

1. 检查日志是否启用：`GILDATA_LOG_ENABLED=true`
2. 检查日志级别设置：确认级别足够高
3. 检查文件权限：确保有写入日志文件的权限

### 敏感信息泄露

如果发现敏感信息泄露：

1. 检查自定义字段名称是否符合脱敏规则
2. 使用`redactSensitiveObject()`函数手动脱敏
3. 提交issue添加新的脱敏规则

## 最佳实践

1. **使用关联ID**：在整个请求链中使用相同的correlationId
2. **合适的日志级别**：
   - Debug：详细的调试信息
   - Info：重要的业务事件
   - Warn：可恢复的异常情况
   - Error：需要立即关注的错误
3. **结构化数据**：使用对象而不是字符串拼接
4. **避免冗余**：不要记录已经记录过的信息
5. **定期清理**：定期清理旧日志文件

## API参考

### `logger`

主要日志接口。

#### 方法

- `debug(message, data?, correlationId?)` - 记录debug级别日志
- `info(message, data?, correlationId?)` - 记录info级别日志
- `warn(message, data?, error?, correlationId?)` - 记录warn级别日志
- `error(message, error, data?, correlationId?)` - 记录error级别日志
- `apiRequest(requestData)` - 记录API请求
- `apiResponse(responseData)` - 记录API响应
- `authEvent(eventData)` - 记录认证事件
- `withCorrelationId(correlationId)` - 创建子logger

### 辅助函数

- `generateCorrelationId()` - 生成新的关联ID
- `setLoggerConfig(config)` - 设置日志配置
- `getLoggerConfig()` - 获取当前日志配置
- `redactSensitiveData(data)` - 脱敏字符串中的敏感数据
- `redactSensitiveObject(data)` - 脱敏对象中的敏感数据
- `redactUsername(username)` - 脱敏用户名

## 更新日志

### 2026.04.15
- 初始版本
- 添加结构化日志支持
- 实现敏感数据脱敏
- 添加关联ID跟踪
