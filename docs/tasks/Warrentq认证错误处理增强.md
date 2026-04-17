# warrenq认证错误处理增强

**作者：** 胡丹
**日期：** 2026-04-15
**状态：** 已完成

## 概述

增强了warrenq认证流程中的错误处理机制，提供了结构化的错误类型、用户友好的错误消息和智能的重试逻辑。

## 实现内容

### 1. 自定义错误类 - warrenqAuthError

**文件：** `extensions/gildata/src/warrenq-auth-error.ts`

#### 错误代码枚举

```typescript
enum warrenqErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",    // 凭证无效
  NETWORK_ERROR = "NETWORK_ERROR",                 // 网络错误
  SERVER_ERROR = "SERVER_ERROR",                   // 服务器错误
  TOKEN_EXPIRED = "TOKEN_EXPIRED",                 // Token过期
  INVALID_CONFIG = "INVALID_CONFIG",               // 配置无效
  UNAUTHORIZED = "UNAUTHORIZED",                   // 未授权
  TOKEN_STORAGE_ERROR = "TOKEN_STORAGE_ERROR",     // Token存储失败
  INVALID_RESPONSE = "INVALID_RESPONSE",           // 响应数据无效
  AUTH_INTERRUPTED = "AUTH_INTERRUPTED",           // 认证流程中断
}
```

#### 用户友好的错误消息

- `INVALID_CREDENTIALS`: "用户名或密码不正确，请检查后重试"
- `NETWORK_ERROR`: "网络连接失败，请检查网络设置后重试"
- `SERVER_ERROR`: "warrenq服务器暂时不可用，请稍后重试"
- `TOKEN_EXPIRED`: "登录已过期，请重新登录"
- `INVALID_CONFIG`: "配置信息不完整，请检查配置文件"
- `UNAUTHORIZED`: "无权限访问，请检查账号权限"
- `TOKEN_STORAGE_ERROR`: "无法保存登录凭证，请检查文件权限"
- `INVALID_RESPONSE`: "服务器返回的数据格式异常"
- `AUTH_INTERRUPTED`: "认证流程被中断"

#### 核心功能

**错误属性：**
- `code`: 错误代码枚举值
- `httpStatus`: HTTP状态码（如果有）
- `retryable`: 是否可重试
- `originalError`: 原始错误对象
- `userMessage`: 用户友好的错误消息
- `timestamp`: 错误发生时间

**静态工厂方法：**
```typescript
// 凭证无效
warrenqAuthError.invalidCredentials(originalError?)

// 网络错误
warrenqAuthError.networkError(originalError?, httpStatus?)

// 服务器错误
warrenqAuthError.serverError(httpStatus, originalError?)

// Token过期
warrenqAuthError.tokenExpired(originalError?)

// 配置无效
warrenqAuthError.invalidConfig(message, originalError?)

// 未授权
warrenqAuthError.unauthorized(httpStatus, originalError?)

// Token存储错误
warrenqAuthError.tokenStorageError(originalError?)

// 响应数据无效
warrenqAuthError.invalidResponse(message, originalError?)

// 从HTTP响应创建错误
warrenqAuthError.fromResponse(response, operation)

// 从任意错误创建warrenqAuthError
warrenqAuthError.fromError(error, context?)

// 类型守卫
warrenqAuthError.iswarrenqAuthError(error): boolean
```

**调试功能：**
```typescript
// 获取完整的调试信息
error.getDebugInfo(): Record<string, unknown>

// 转换为日志记录
error.toLog(): string
```

### 2. 重试逻辑工具 - retry-utils.ts

**文件：** `extensions/gildata/src/retry-utils.ts`

#### 核心函数

**withRetry - 带重试的异步函数执行器**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T>
```

#### 重试配置选项

```typescript
interface RetryOptions {
  maxRetries?: number;              // 最大重试次数，默认3
  initialDelay?: number;            // 初始延迟（毫秒），默认1000ms
  delayMultiplier?: number;         // 延迟乘数，默认2
  maxDelay?: number;                // 最大延迟（毫秒），默认10000ms
  shouldRetry?: (error: unknown) => boolean;  // 自定义判断函数
  onRetry?: (attempt: number, error: unknown) => void;  // 重试前回调
  onAttempt?: (attempt: number) => void;  // 每次尝试前回调
}
```

#### 预定义配置

**createRetryOptions - 标准重试配置**
```typescript
// 默认配置
const options = createRetryOptions(3);

// 配置详情：
// - 最大重试次数：3次
// - 初始延迟：1000ms (1秒)
// - 延迟乘数：2 (指数退避)
// - 最大延迟：10000ms (10秒)
// - 重试序列：1s, 2s, 4s
// - 只对网络错误和服务器错误重试
```

**createNoRetryOptions - 不重试配置**
```typescript
// 用于登录操作，避免暴力破解
const options = createNoRetryOptions();

// 配置详情：
// - 最大重试次数：0次
// - 不允许任何重试
```

**createFastRetryOptions - 快速重试配置**
```typescript
// 用于非关键操作
const options = createFastRetryOptions(2);

// 配置详情：
// - 最大重试次数：2次
// - 初始延迟：500ms
// - 延迟乘数：1.5
// - 最大延迟：3000ms
// - 重试序列：500ms, 750ms
```

#### 重试逻辑详情

**指数退避算法：**
```typescript
delay = initialDelay * (delayMultiplier ^ (attempt - 1))

// 示例（initialDelay=1000, multiplier=2）:
// 尝试1失败 → 等待1000ms → 尝试2
// 尝试2失败 → 等待2000ms → 尝试3
// 尝试3失败 → 等待4000ms → 尝试4
```

**重试判断逻辑：**
1. 检查是否还有剩余重试次数
2. 检查错误是否允许重试（通过`shouldRetry`函数）
3. 对于HTTP错误：
   - 401/403：不重试（认证失败）
   - 400/404/422：不重试（客户端错误）
   - 5xx：重试（服务器错误）
   - 网络错误：重试（连接失败）

### 3. 集成到现有代码

#### warrenq-login.ts 更新

**Token存储操作：**
```typescript
// 保存Token
async saveToken(data: warrenqTenantInfo): Promise<void> {
  try {
    // ... 保存逻辑
  } catch (error) {
    throw warrenqAuthError.tokenStorageError(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// 读取Token
async getToken(): Promise<warrenqTenantInfo | null> {
  try {
    // ... 读取逻辑
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw warrenqAuthError.fromError(error, "读取token失败");
  }
}
```

**登录操作（不重试）：**
```typescript
async login(username: string, password: string): Promise<warrenqLoginResponse> {
  try {
    const response = await fetch(...);
    if (!response.ok) {
      throw warrenqAuthError.fromResponse(response, "登录失败");
    }
    return await response.json();
  } catch (error) {
    if (warrenqAuthError.iswarrenqAuthError(error)) {
      throw error;
    }
    if (error instanceof Error && (error.name === "TypeError" || error.name === "AbortError")) {
      throw warrenqAuthError.networkError(error);
    }
    throw warrenqAuthError.fromError(error, "登录失败");
  }
}
```

**获取租户信息（带重试）：**
```typescript
async getTenantInfo(token: string): Promise<warrenqTenantInfo> {
  return withRetry(
    async () => {
      const response = await fetch(...);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw warrenqAuthError.fromResponse(response, "获取租户信息失败");
        }
        throw warrenqAuthError.fromResponse(response, "获取租户信息失败");
      }
      const data = await response.json();
      if (!data.data || !data.data.tenantId || !data.data.userId) {
        throw warrenqAuthError.invalidResponse("无法从响应中解析租户信息");
      }
      return data.data;
    },
    createRetryOptions(3)  // 最多3次重试，1s/2s/4s
  );
}
```

#### warrenq-auth.ts 更新

**自动登录错误处理：**
```typescript
try {
  const tenantInfo = await loginClient.loginAndGetToken(username, password);
  // ... 成功处理
} catch (error) {
  if (warrenqAuthError.iswarrenqAuthError(error)) {
    await prompter?.error(`登录失败: ${error.userMessage}`);
    // 记录详细错误信息用于调试
    console.error("[warrenq Auth Error]", error.toLog());
    throw error;
  }

  const errorMessage = error instanceof Error ? error.message : "未知错误";
  await prompter?.error(`登录失败: ${errorMessage}`);
  throw warrenqAuthError.fromError(error, "自动登录失败");
}
```

**非交互登录错误处理：**
```typescript
try {
  const tenantInfo = await loginClient.loginAndGetToken(envUsername, envPassword);
  await tokenStorage.saveToken(tenantInfo);
  return config;
} catch (error) {
  if (warrenqAuthError.iswarrenqAuthError(error)) {
    console.error(`warrenq非交互登录失败 [${error.code}]: ${error.userMessage}`);
    console.error("[详细错误信息]", error.toLog());
    return null;
  }

  const errorMessage = error instanceof Error ? error.message : "未知错误";
  console.error(`warrenq非交互登录失败: ${errorMessage}`);
  console.error("[原始错误]", error);
  return null;
}
```

### 4. 测试覆盖

**文件：** `extensions/gildata/src/warrenq-auth-error.test.ts`

测试覆盖范围：
- warrenqAuthError类的所有静态工厂方法
- 错误属性验证（code, retryable, userMessage等）
- 原始错误保留和堆栈跟踪
- HTTP响应到错误的转换
- 普通Error到warrenqAuthError的转换
- 类型守卫功能
- 调试信息生成
- withRetry函数的重试逻辑
- 指数退避算法验证
- 可重试/不可重试错误的处理
- 自定义重试配置

## 使用示例

### 示例1：基本错误处理

```typescript
import { warrenqAuthError } from "./warrenq-auth-error.js";

try {
  await loginClient.login(username, password);
} catch (error) {
  if (warrenqAuthError.iswarrenqAuthError(error)) {
    // 用户友好的消息
    console.error(error.userMessage);

    // 技术细节（用于调试）
    console.error(error.getDebugInfo());

    // 记录完整日志
    console.error(error.toLog());
  }
}
```

### 示例2：带重试的API调用

```typescript
import { withRetry, createRetryOptions } from "./retry-utils.js";
import { warrenqAuthError } from "./warrenq-auth-error.js";

const result = await withRetry(
  async () => {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw warrenqAuthError.fromResponse(response, "API调用失败");
    }
    return await response.json();
  },
  createRetryOptions(3)
);
```

### 示例3：自定义重试逻辑

```typescript
import { withRetry } from "./retry-utils.js";

const result = await withRetry(
  async () => {
    // 你的API调用
  },
  {
    maxRetries: 5,
    initialDelay: 2000,
    delayMultiplier: 2,
    maxDelay: 30000,
    shouldRetry: (error) => {
      // 只对特定错误重试
      return error.code === "NETWORK_ERROR" ||
             error.httpStatus >= 500;
    },
    onRetry: (attempt, error) => {
      console.warn(`第${attempt}次重试: ${error.message}`);
    }
  }
);
```

## 错误处理策略

### 重试策略

| 操作类型 | 重试策略 | 原因 |
|---------|---------|------|
| 登录（username/password） | 不重试 | 避免暴力破解 |
| 获取Token | 不重试 | 认证失败不应重试 |
| 获取租户信息 | 重试3次（1s/2s/4s） | 可能是瞬时故障 |
| API调用 | 重试3次（1s/2s/4s） | 可能是网络问题 |
| Token存储 | 不重试 | 文件系统错误通常持久 |

### 错误分类

**可重试的错误：**
- NETWORK_ERROR（网络连接失败）
- SERVER_ERROR（5xx服务器错误）
- INVALID_RESPONSE（响应格式异常）

**不可重试的错误：**
- INVALID_CREDENTIALS（凭证错误）
- UNAUTHORIZED（401/403未授权）
- TOKEN_EXPIRED（Token过期）
- INVALID_CONFIG（配置问题）
- TOKEN_STORAGE_ERROR（存储错误）

## 改进效果

### 之前
```typescript
// 基本错误处理
try {
  await loginClient.login(username, password);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "未知错误";
  await prompter?.error(`登录失败: ${errorMessage}`);
  throw error;
}
```

### 之后
```typescript
// 结构化错误处理
try {
  await loginClient.login(username, password);
} catch (error) {
  if (warrenqAuthError.iswarrenqAuthError(error)) {
    // 用户友好的消息
    await prompter?.error(`登录失败: ${error.userMessage}`);

    // 技术细节用于调试
    console.error("[warrenq Auth Error]", error.toLog());

    throw error;
  }

  // 处理其他错误
  throw warrenqAuthError.fromError(error, "自动登录失败");
}
```

## 日志输出示例

### 用户友好消息（显示给用户）
```
登录失败: 用户名或密码不正确，请检查后重试
```

### 技术日志（用于调试）
```json
{
  "name": "warrenqAuthError",
  "code": "INVALID_CREDENTIALS",
  "message": "用户名或密码不正确，请检查后重试",
  "httpStatus": 401,
  "retryable": false,
  "timestamp": "2026-04-15T14:30:45.123Z",
  "originalError": "login failed: HTTP 401 Unauthorized"
}
```

### 重试日志输出
```
[warrenq] 第1次重试: 网络连接失败，请检查网络设置后重试
[warrenq] 执行第2次尝试...
[warrenq] 第2次重试: 网络连接失败，请检查网络设置后重试
[warrenq] 执行第3次尝试...
```

## 文件清单

### 新增文件
- `extensions/gildata/src/warrenq-auth-error.ts` - 自定义错误类
- `extensions/gildata/src/retry-utils.ts` - 重试逻辑工具
- `extensions/gildata/src/warrenq-auth-error.test.ts` - 错误处理测试
- `docs/tasks/warrenq认证错误处理增强.md` - 本文档

### 修改文件
- `extensions/gildata/src/warrenq-login.ts` - 集成错误处理和重试
- `extensions/gildata/src/warrenq-auth.ts` - 集成错误处理

## 技术亮点

1. **类型安全**：完整的TypeScript类型定义
2. **用户友好**：双层级消息（用户友好 + 技术详细）
3. **智能重试**：指数退避算法 + 错误分类
4. **调试友好**：完整的错误上下文和堆栈跟踪
5. **灵活性**：支持自定义重试配置
6. **安全性**：登录操作不重试，避免暴力破解

## 后续建议

1. **监控集成**：考虑添加错误监控和告警
2. **指标收集**：收集重试成功率、平均重试次数等指标
3. **熔断机制**：对于频繁失败的操作，可以添加熔断器
4. **本地缓存**：对于成功的认证结果，考虑短期缓存
5. **健康检查**：添加健康检查端点，监控认证服务状态

## 总结

通过实现结构化的错误处理和智能重试逻辑，显著提升了warrenq认证流程的：
- **可靠性**：通过重试机制处理瞬时故障
- **用户体验**：清晰、友好的错误消息
- **可维护性**：结构化的错误类型便于调试
- **安全性**：避免对认证失败的重试
