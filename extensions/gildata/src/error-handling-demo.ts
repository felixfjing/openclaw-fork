/**
 * warrenq错误处理功能演示
 * 用于验证错误处理和重试逻辑的基本功能
 */

import {
  warrenqAuthError,
  warrenqErrorCode,
} from "./warrenq-auth-error.js";
import { withRetry, createRetryOptions } from "./retry-utils.js";

console.log("=== warrenq错误处理功能演示 ===\n");

// 1. 演示错误类创建
console.log("1. 创建各种类型的错误:");

const invalidCredentialsError = warrenqAuthError.invalidCredentials();
console.log(`  - 凭证无效错误: ${invalidCredentialsError.userMessage}`);
console.log(`  - 代码: ${invalidCredentialsError.code}`);
console.log(`  - 可重试: ${invalidCredentialsError.retryable}`);

const networkError = warrenqAuthError.networkError();
console.log(`  - 网络错误: ${networkError.userMessage}`);
console.log(`  - 代码: ${networkError.code}`);
console.log(`  - 可重试: ${networkError.retryable}`);

const serverError = warrenqAuthError.serverError(503);
console.log(`  - 服务器错误: ${serverError.userMessage}`);
console.log(`  - HTTP状态: ${serverError.httpStatus}`);
console.log(`  - 可重试: ${serverError.retryable}`);

console.log("");

// 2. 演示从HTTP响应创建错误
console.log("2. 从HTTP响应创建错误:");

const response401 = { status: 401, statusText: "Unauthorized" } as Response;
const error401 = warrenqAuthError.fromResponse(response401, "测试操作");
console.log(`  - 401错误: ${error401.userMessage}`);
console.log(`  - 可重试: ${error401.retryable}`);

const response500 = { status: 500, statusText: "Internal Server Error" } as Response;
const error500 = warrenqAuthError.fromResponse(response500, "测试操作");
console.log(`  - 500错误: ${error500.userMessage}`);
console.log(`  - 可重试: ${error500.retryable}`);

console.log("");

// 3. 演示调试信息
console.log("3. 调试信息:");

const debugError = warrenqAuthError.invalidCredentials(new Error("原始错误"));
const debugInfo = debugError.getDebugInfo();
console.log(`  - 调试信息:`);
console.log(JSON.stringify(debugInfo, null, 2));

console.log("");
console.log(`  - 日志格式:`);
console.log(debugError.toLog());

console.log("");

// 4. 演示类型守卫
console.log("4. 类型守卫:");

const testError1 = warrenqAuthError.invalidCredentials();
const testError2 = new Error("普通错误");

console.log(`  - warrenqAuthError.iswarrenqAuthError(testError1): ${warrenqAuthError.iswarrenqAuthError(testError1)}`);
console.log(`  - warrenqAuthError.iswarrenqAuthError(testError2): ${warrenqAuthError.iswarrenqAuthError(testError2)}`);

console.log("");

// 5. 演示重试逻辑
console.log("5. 重试逻辑演示:");

let attemptCount = 0;
const mockSuccessAfter3Attempts = async () => {
  attemptCount++;
  console.log(`  - 尝试 ${attemptCount}...`);
  if (attemptCount < 3) {
    throw warrenqAuthError.networkError(new Error("模拟网络错误"));
  }
  return "成功!";
};

try {
  const result = await withRetry(mockSuccessAfter3Attempts, {
    maxRetries: 3,
    initialDelay: 100,
    onRetry: (attempt, error) => {
      console.log(`  - 重试 ${attempt}: ${error.userMessage}`);
    },
  });
  console.log(`  - 最终结果: ${result}`);
} catch (error) {
  console.log(`  - 最终失败: ${error instanceof Error ? error.message : String(error)}`);
}

console.log("");

// 6. 演示不可重试的错误
console.log("6. 不可重试的错误演示:");

let credentialAttempts = 0;
const mockCredentialError = async () => {
  credentialAttempts++;
  console.log(`  - 尝试 ${credentialAttempts}...`);
  throw warrenqAuthError.invalidCredentials();
};

try {
  await withRetry(mockCredentialError, createRetryOptions(3));
  console.log(`  - 意外成功`);
} catch (error) {
  if (warrenqAuthError.iswarrenqAuthError(error)) {
    console.log(`  - 正确不重试，只尝试了${credentialAttempts}次`);
    console.log(`  - 错误消息: ${error.userMessage}`);
  }
}

console.log("");

// 7. 演示错误代码枚举
console.log("7. 错误代码枚举:");
console.log(`  - INVALID_CREDENTIALS: ${warrenqErrorCode.INVALID_CREDENTIALS}`);
console.log(`  - NETWORK_ERROR: ${warrenqErrorCode.NETWORK_ERROR}`);
console.log(`  - SERVER_ERROR: ${warrenqErrorCode.SERVER_ERROR}`);
console.log(`  - TOKEN_EXPIRED: ${warrenqErrorCode.TOKEN_EXPIRED}`);
console.log(`  - INVALID_CONFIG: ${warrenqErrorCode.INVALID_CONFIG}`);
console.log(`  - UNAUTHORIZED: ${warrenqErrorCode.UNAUTHORIZED}`);

console.log("");

console.log("=== 演示完成 ===");
