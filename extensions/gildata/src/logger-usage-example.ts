/**
 * Gildata Provider 日志系统使用示例
 *
 * 此文件展示了如何在实际应用中使用日志系统
 */

import {
  logger,
  generateCorrelationId,
  setLoggerConfig,
  LogLevel,
} from "./logger.js";

// 示例1: 基本日志记录
function basicLoggingExample() {
  console.log("=== 基本日志记录示例 ===\n");

  // Debug日志（默认生产环境不显示）
  logger.debug("这是一个调试消息", { userId: "123" });

  // Info日志（重要操作信息）
  logger.info("用户登录成功", {
    userId: "123",
    tenantId: "456",
    loginTime: new Date().toISOString(),
  });

  // Warn日志（警告信息）
  logger.warn("配置缺失", {
    configKey: "apiKey",
    defaultValue: "using default",
  });

  // Error日志（错误信息）
  try {
    throw new Error("模拟错误");
  } catch (error) {
    logger.error("操作失败", error as Error, {
      operation: "login",
      userId: "123",
    });
  }

  console.log();
}

// 示例2: 使用关联ID跟踪请求链
async function correlationIdExample() {
  console.log("=== 关联ID跟踪示例 ===\n");

  const correlationId = generateCorrelationId();

  logger.info("开始处理请求", {
    requestId: "req-123",
    operation: "login",
  }, correlationId);

  // 步骤1：验证
  logger.debug("验证用户凭证", {
    username: "testuser",
  }, correlationId);

  // 步骤2：认证
  logger.info("用户认证成功", {
    userId: "123",
  }, correlationId);

  // 步骤3：获取数据
  logger.info("获取用户数据", {
    userId: "123",
    dataCount: 10,
  }, correlationId);

  // 完成
  logger.info("请求处理完成", {
    requestId: "req-123",
    duration: 1000,
  }, correlationId);

  console.log();
}

// 示例3: 使用子Logger
async function childLoggerExample() {
  console.log("=== 子Logger示例 ===\n");

  const correlationId = generateCorrelationId();
  const childLogger = logger.withCorrelationId(correlationId);

  childLogger.info("开始批量处理");

  // 批量处理中的每个操作都使用相同的correlationId
  childLogger.info("处理项目 1", { itemId: "1" });
  childLogger.info("处理项目 2", { itemId: "2" });
  childLogger.info("处理项目 3", { itemId: "3" });

  childLogger.info("批量处理完成", {
    totalItems: 3,
    successCount: 3,
  });

  // 获取当前的correlationId
  console.log(`当前关联ID: ${childLogger.getCorrelationId()}`);

  console.log();
}

// 示例4: API请求日志记录
async function apiLoggingExample() {
  console.log("=== API请求日志示例 ===\n");

  const correlationId = generateCorrelationId();

  // 记录API请求
  logger.apiRequest({
    method: "POST",
    url: "https://api.gildata.com/v1/chat",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer secret_token_123",  // 会被脱敏
    },
    body: {
      message: "Hello",
      model: "qwen-plus",
    },
    correlationId,
  });

  // 记录API响应
  logger.apiResponse({
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": "req-456",
    },
    body: {
      result: "Success",
      response: "Hello! How can I help you?",
    },
    duration: 1500,
    correlationId,
  });

  console.log();
}

// 示例5: 认证事件日志
async function authEventExample() {
  console.log("=== 认证事件日志示例 ===\n");

  const correlationId = generateCorrelationId();

  // 登录尝试
  logger.authEvent({
    eventType: "login_attempt" as any,
    username: "testuser",
    success: true,
    correlationId,
  });

  // 登录成功
  logger.authEvent({
    eventType: "login_success" as any,
    username: "testuser",
    userId: "123",
    tenantId: "456",
    success: true,
    correlationId,
  });

  // Token存储
  logger.authEvent({
    eventType: "token_store" as any,
    userId: "123",
    tenantId: "456",
    success: true,
    correlationId,
  });

  console.log();
}

// 示例6: 配置日志系统
function configExample() {
  console.log("=== 日志配置示例 ===\n");

  // 获取当前配置
  const currentConfig = setLoggerConfig({
    level: LogLevel.DEBUG,
    enabled: true,
    includeCorrelationId: true,
    logToFile: false,
    logToConsole: true,
  });

  console.log("当前配置:", JSON.stringify(currentConfig, null, 2));

  console.log();
}

// 示例7: 敏感数据脱敏
function redactionExample() {
  console.log("=== 敏感数据脱敏示例 ===\n");

  import { redactSensitiveData, redactSensitiveObject, redactUsername } from "./logger.js";

  // 字符串脱敏
  const jsonString = JSON.stringify({
    username: "john.doe",
    password: "secret123",
    apiKey: "sk-proj-123456",
  });
  const redactedString = redactSensitiveData(jsonString);
  console.log("原始数据:", jsonString);
  console.log("脱敏后:", redactedString);
  console.log();

  // 对象脱敏
  const data = {
    user: {
      username: "john.doe",
      password: "secret123",
      email: "john@example.com",
    },
    credentials: {
      apiKey: "sk-proj-123456",
      accessToken: "token-abc-123",
    },
  };
  const redactedObject = redactSensitiveObject(data);
  console.log("原始对象:", JSON.stringify(data, null, 2));
  console.log("脱敏后:", JSON.stringify(redactedObject, null, 2));
  console.log();

  // 用户名脱敏
  const usernames = ["john.doe", "ab", "verylongusername", "a", ""];
  usernames.forEach((username) => {
    const masked = redactUsername(username);
    console.log(`${username.padEnd(20)} -> ${masked}`);
  });

  console.log();
}

// 示例8: 实际应用场景 - 用户登录流程
async function loginFlowExample() {
  console.log("=== 实际应用：用户登录流程 ===\n");

  const correlationId = generateCorrelationId();

  try {
    // 1. 开始登录
    logger.info("开始用户登录流程", {
      username: "testuser",
      loginMethod: "password",
    }, correlationId);

    // 2. 验证凭证
    logger.debug("验证用户凭证", {
      username: "testuser",
    }, correlationId);

    // 模拟API调用
    logger.apiRequest({
      method: "POST",
      url: "https://api.warrenq.com/cloudtest/oauth/v2/oauth/login",
      headers: {
        "Content-Type": "multipart/form-data",
        "Authorization": "Bearer temp_token",
      },
      body: {
        username: "testuser",
        password: "password123",  // 会被脱敏
      },
      correlationId,
    }, correlationId);

    // 模拟API响应
    logger.apiResponse({
      status: 200,
      headers: {},
      body: {
        code: 200,
        message: "success",
        data: {
          access_token: "generated_token_123",  // 会被脱敏
          userId: "user123",
          tenantId: "tenant456",
        },
      },
      duration: 500,
      correlationId,
    }, correlationId);

    // 3. 获取租户信息
    logger.info("获取租户信息", {
      userId: "user123",
    }, correlationId);

    logger.apiRequest({
      method: "POST",
      url: "https://api.warrenq.com/cloudtest/platform/v2/sysUser/self",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer generated_token_123",  // 会被脱敏
      },
      body: {},
      correlationId,
    }, correlationId);

    logger.apiResponse({
      status: 200,
      headers: {},
      body: {
        userId: "user123",
        tenantId: "tenant456",
        username: "testuser",
      },
      duration: 300,
      correlationId,
    }, correlationId);

    // 4. 认证事件
    logger.authEvent({
      eventType: "login_success" as any,
      username: "testuser",
      userId: "user123",
      tenantId: "tenant456",
      success: true,
      correlationId,
    }, correlationId);

    logger.authEvent({
      eventType: "token_store" as any,
      userId: "user123",
      tenantId: "tenant456",
      success: true,
      correlationId,
    }, correlationId);

    // 5. 完成
    logger.info("登录流程完成", {
      userId: "user123",
      tenantId: "tenant456",
      username: "testuser",
      totalTime: 800,
    }, correlationId);

  } catch (error) {
    logger.error("登录流程失败", error as Error, {
      username: "testuser",
      correlationId,
    }, correlationId);
  }

  console.log();
}

// 运行所有示例
async function runAllExamples() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  Gildata Provider 日志系统使用示例                    ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // 配置日志系统
  setLoggerConfig({
    level: LogLevel.DEBUG,  // 开发环境使用DEBUG级别
    enabled: true,
    includeCorrelationId: true,
    logToFile: false,
    logToConsole: true,   // 启用控制台输出
  });

  basicLoggingExample();
  await correlationIdExample();
  childLoggerExample();
  await apiLoggingExample();
  await authEventExample();
  configExample();
  redactionExample();
  await loginFlowExample();

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  所有示例执行完成                                        ║");
  console.log("╚════════════════════════════════════════════════════════╝");
}

// 导出示例函数
export {
  basicLoggingExample,
  correlationIdExample,
  childLoggerExample,
  apiLoggingExample,
  authEventExample,
  configExample,
  redactionExample,
  loginFlowExample,
  runAllExamples,
};

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
