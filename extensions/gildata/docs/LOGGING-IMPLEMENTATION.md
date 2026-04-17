# Gildata Provider 日志系统实现报告

## 概述

已成功为warrenq认证和API调用添加了结构化日志记录系统。该系统提供了完整的日志功能，包括多级别日志、敏感数据脱敏、关联ID跟踪和结构化JSON输出。

## 实现内容

### 1. 日志系统核心 (`logger.ts`)

#### 主要功能
- **多级别日志**：支持debug、info、warn、error四个级别
- **敏感数据脱敏**：自动脱敏password、token、apiKey等敏感字段
- **关联ID跟踪**：支持请求链追踪
- **结构化输出**：JSON格式和控制台格式双输出
- **灵活配置**：支持环境变量和运行时配置

#### API接口
```typescript
// 基本日志
logger.debug(message, data?, correlationId?)
logger.info(message, data?, correlationId?)
logger.warn(message, data?, error?, correlationId?)
logger.error(message, error, data?, correlationId?)

// API日志
logger.apiRequest(requestData)
logger.apiResponse(responseData)

// 认证事件日志
logger.authEvent(eventData)

// 子logger（固定关联ID）
const childLogger = logger.withCorrelationId(correlationId)
```

#### 配置选项
```typescript
setLoggerConfig({
  level: LogLevel.DEBUG,          // 日志级别
  enabled: true,                 // 启用/禁用日志
  includeCorrelationId: true,     // 包含关联ID
  logToFile: false,              // 文件输出
  logToConsole: true,            // 控制台输出
  filePath: "/path/to/log",      // 日志文件路径
})
```

### 2. 集成到关键模块

#### warrenq-login.ts
- **登录流程**：记录登录尝试、成功、失败事件
- **Token存储**：记录token保存、读取、清除操作
- **租户信息**：记录租户信息获取过程
- **性能监控**：记录各步骤耗时

```typescript
// 示例：登录方法
logger.authEvent({
  eventType: AuthEventType.LOGIN_ATTEMPT,
  username,
  success: true,
  correlationId,
});
```

#### warrenq-auth.ts
- **认证配置**：记录交互式和非交互式认证配置
- **运行时认证**：记录认证准备过程
- **错误处理**：记录认证失败详情

```typescript
// 示例：认证配置
logger.info("开始交互式warrenq认证配置", {
  hasPrompter: !!prompter,
}, correlationId);
```

#### http-client.ts
- **API请求**：记录所有HTTP请求（包括方法、URL、头部、body）
- **API响应**：记录响应状态、头部、响应时间
- **错误处理**：记录网络错误和超时

```typescript
// 示例：API请求日志
logger.apiRequest({
  method: "POST",
  url: "https://api.example.com/endpoint",
  headers: { "Authorization": "Bearer token" },  // 自动脱敏
  body: { data: "test" },
  correlationId,
});
```

### 3. 敏感数据脱敏

#### 脱敏规则
系统会自动脱敏以下敏感字段：

1. **密码字段**：`password`、`passwd`、`pwd`
2. **Token字段**：`token`、`access_token`、`refresh_token`
3. **API密钥**：`apiKey`、`api_key`、`api-token`
4. **授权头**：`Authorization`
5. **私钥**：`private_key`、`privateKey`
6. **环境变量**：`GILDATA_API_TOKEN`、`warrenq_PASSWORD`
7. **会话ID**：`session_id`、`sessionId`（部分脱敏）

#### 用户名脱敏
保留首尾字符，中间用星号替换：
- `username` → `u******e`
- `ab` → `ab`（保留完整）
- `a` → `***`

#### 示例
```typescript
// 原始数据
const data = {
  username: "john.doe",
  password: "secret123",
  apiKey: "sk-proj-123456"
};

// 脱敏后
const redacted = redactSensitiveObject(data);
// 结果：
// {
//   username: "j***e",
//   password: "[REDACTED]",
//   apiKey: "[REDACTED]"
// }
```

### 4. 关联ID跟踪

每个操作都会生成唯一的关联ID，用于跟踪整个请求链：

```typescript
const correlationId = generateCorrelationId();

// 所有相关操作都使用相同的correlationId
logger.info("步骤1", {}, correlationId);
logger.info("步骤2", {}, correlationId);
logger.info("步骤3", {}, correlationId);

// 或使用子logger
const childLogger = logger.withCorrelationId(correlationId);
childLogger.info("步骤1");
childLogger.info("步骤2");
```

### 5. 日志输出格式

#### 控制台输出
```
[2025-04-16T08:30:00.000Z] [INFO] [gildata-provider] [gildata-1744794600000-abc123] 开始登录流程
Data: {
  "username": "t******r"
}
```

#### 文件输出（JSON格式）
```json
{
  "timestamp": "2025-04-16T08:30:00.000Z",
  "level": "info",
  "subsystem": "gildata-provider",
  "correlationId": "gildata-1744794600000-abc123",
  "message": "开始登录流程",
  "data": {
    "username": "t******r"
  }
}
```

## 测试结果

### logger.test.ts
- **27个测试全部通过**
- 覆盖所有核心功能：
  - 关联ID生成
  - 日志配置
  - 日志级别控制
  - 日志输出格式
  - 关联ID跟踪
  - 敏感数据脱敏
  - API日志记录
  - 认证事件日志
  - 日志禁用功能

### warrenq-auth.test.ts
- **11个测试全部通过**
- 验证日志集成正常工作：
  - 认证配置日志
  - 运行时认证日志
  - 错误处理日志

## 使用示例

### 基本使用
```typescript
import { logger, generateCorrelationId } from "./logger.js";

const correlationId = generateCorrelationId();

logger.info("操作完成", {
  userId: "123",
  status: "success",
}, correlationId);
```

### API调用日志
```typescript
const correlationId = generateCorrelationId();

// 记录请求
logger.apiRequest({
  method: "POST",
  url: "https://api.example.com/endpoint",
  headers: { "Authorization": "Bearer token" },
  body: { data: "test" },
  correlationId,
});

// 记录响应
logger.apiResponse({
  status: 200,
  headers: { "content-type": "application/json" },
  body: { result: "success" },
  duration: 150,
  correlationId,
});
```

### 认证事件
```typescript
logger.authEvent({
  eventType: "login_success",
  username: "testuser",  // 自动脱敏
  userId: "123",
  tenantId: "456",
  success: true,
  correlationId,
});
```

## 配置说明

### 环境变量
```bash
# 日志级别（debug, info, warn, error）
export GILDATA_LOG_LEVEL=debug

# 启用日志
export GILDATA_LOG_ENABLED=true

# 控制台输出
export GILDATA_LOG_CONSOLE=true

# 日志文件
export GILDATA_LOG_FILE=/path/to/gildata.log
```

### 默认配置
- **级别**：INFO（生产环境关闭debug）
- **启用状态**：true
- **关联ID**：包含
- **控制台输出**：false
- **文件输出**：false

## 文件清单

### 新增文件
1. `extensions/gildata/src/logger.test.ts` - 日志系统测试
2. `extensions/gildata/src/logger-usage-example.ts` - 使用示例

### 修改文件
1. `extensions/gildata/src/logger.ts` - 日志系统实现
2. `extensions/gildata/src/types.ts` - 类型定义
3. `extensions/gildata/src/warrenq-login.ts` - 登录模块日志集成
4. `extensions/gildata/src/warrenq-auth.ts` - 认证模块日志集成
5. `extensions/gildata/src/http-client.ts` - HTTP客户端日志集成
6. `extensions/gildata/LOGGING.md` - 日志系统文档

## 关键特性

### 1. 安全性
- 自动脱敏所有敏感数据
- 支持自定义脱敏规则
- 用户名智能脱敏（保留首尾字符）

### 2. 性能
- 异步友好设计
- 禁用日志时零开销
- 生产环境默认使用info级别

### 3. 可调试性
- 关联ID跟踪请求链
- 结构化JSON输出
- 详细的错误上下文

### 4. 灵活性
- 环境变量配置
- 运行时动态配置
- 双输出格式（控制台+文件）

## 最佳实践

1. **使用关联ID**：对于多步骤操作，始终传入correlationId
2. **合理选择级别**：
   - Debug：详细信息
   - Info：关键操作
   - Warn：警告
   - Error：错误
3. **结构化数据**：使用对象而非字符串拼接
4. **避免冗余**：不重复记录相同信息
5. **生产配置**：使用info级别，关闭debug

## 测试验证

### 运行日志测试
```bash
pnpm test extensions/gildata/src/logger.test.ts
```

### 运行认证测试
```bash
pnpm test extensions/gildata/src/warrenq-auth.test.ts
```

### 运行使用示例
```bash
# 开发环境
export GILDATA_LOG_LEVEL=debug
export GILDATA_LOG_CONSOLE=true

# 运行示例（需要TypeScript运行器）
# node --loader tsx extensions/gildata/src/logger-usage-example.ts
```

## 总结

成功实现了完整的结构化日志记录系统，具有以下特点：

1. **功能完整**：覆盖所有认证和API调用场景
2. **安全性强**：自动脱敏敏感数据
3. **易于调试**：关联ID跟踪和结构化输出
4. **高度可配置**：支持多种配置方式
5. **测试完备**：所有功能都有测试覆盖
6. **文档齐全**：提供详细的使用文档和示例

该系统已在warrenq-login.ts、warrenq-auth.ts和http-client.ts等关键模块中成功集成，为Gildata Provider提供了强大的日志记录和调试能力。

## 作者
胡丹

## 日期
2025-04-16
