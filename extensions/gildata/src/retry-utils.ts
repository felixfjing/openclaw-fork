/**
 * 重试工具
 *
 * 提供带指数退避的重试逻辑，适用于网络操作和API调用
 */

import type { warrenqAuthError } from "./warrenq-auth-error.js";

/**
 * 重试配置选项
 */
export interface RetryOptions {
  /** 最大重试次数，默认为3 */
  maxRetries?: number;

  /** 初始延迟（毫秒），默认为1000ms */
  initialDelay?: number;

  /** 延迟乘数，默认为2 */
  delayMultiplier?: number;

  /** 最大延迟（毫秒），默认为10000ms */
  maxDelay?: number;

  /** 自定义判断函数，决定是否应该重试 */
  shouldRetry?: (error: unknown) => boolean;

  /** 重试前的回调函数 */
  onRetry?: (attempt: number, error: unknown) => void;

  /** 每次尝试前的回调函数 */
  onAttempt?: (attempt: number) => void;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1秒
  delayMultiplier: 2,
  maxDelay: 10000, // 10秒
  shouldRetry: () => true,
  onRetry: () => {},
  onAttempt: () => {},
};

/**
 * 计算退避延迟时间
 *
 * @param attempt - 当前尝试次数（从1开始）
 * @param initialDelay - 初始延迟
 * @param multiplier - 延迟乘数
 * @param maxDelay - 最大延迟
 * @returns 延迟时间（毫秒）
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  multiplier: number,
  maxDelay: number
): number {
  // 指数退避：delay = initialDelay * (multiplier ^ (attempt - 1))
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);

  // 不超过最大延迟
  return Math.min(delay, maxDelay);
}

/**
 * 延迟执行
 *
 * @param ms - 延迟时间（毫秒）
 * @returns Promise，在指定时间后解析
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 *
 * @param fn - 要执行的异步函数
 * @param options - 重试配置选项
 * @returns Promise，函数执行结果或最终错误
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch(url),
 *   {
 *     maxRetries: 3,
 *     shouldRetry: (error) => error.code === warrenqErrorCode.NETWORK_ERROR,
 *     onRetry: (attempt, error) => console.log(`重试第${attempt}次: ${error.message}`)
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const config: Required<RetryOptions> = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  // 从第1次尝试开始（不是从0开始，这样第一次不是重试）
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      config.onAttempt(attempt);

      // 执行函数
      const result = await fn();

      // 成功，返回结果
      return result;
    } catch (error) {
      lastError = error;

      // 判断是否应该重试
      const canRetry =
        attempt <= config.maxRetries && // 还有剩余重试次数
        config.shouldRetry(error); // 且错误允许重试

      if (!canRetry) {
        // 不应该重试或已达到最大重试次数，抛出错误
        throw error;
      }

      // 计算退避延迟
      const delayMs = calculateBackoffDelay(
        attempt,
        config.initialDelay,
        config.delayMultiplier,
        config.maxDelay
      );

      // 调用重试回调
      config.onRetry(attempt, error);

      // 等待后重试
      await delay(delayMs);
    }
  }

  // 理论上不应该到达这里
  throw lastError;
}

/**
 * 检查错误是否为warrenqAuthError并可重试
 *
 * @param error - 错误对象
 * @returns 如果是warrenqAuthError且可重试，返回true
 */
function isRetryablewarrenqError(error: unknown): error is warrenqAuthError {
  // @ts-ignore - 动态检查retryable属性
  return error?.retryable === true;
}

/**
 * 为warrenqAuthError优化的重试配置
 *
 * @param maxRetries - 最大重试次数，默认为3
 * @returns RetryOptions配置对象
 */
export function createRetryOptions(maxRetries: number = 3): RetryOptions {
  return {
    maxRetries,
    initialDelay: 1000, // 1秒
    delayMultiplier: 2, // 1s, 2s, 4s, 8s...
    maxDelay: 10000, // 最大10秒
    shouldRetry: (error: unknown) => {
      // 只对网络错误和服务器错误进行重试
      return isRetryablewarrenqError(error);
    },
    onRetry: (attempt: number, error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[warrenq] 第${attempt}次重试: ${errorMessage}`);
    },
    onAttempt: (attempt: number) => {
      if (attempt > 1) {
        console.log(`[warrenq] 执行第${attempt}次尝试...`);
      }
    },
  };
}

/**
 * 无重试的配置（用于认证操作）
 *
 * 对于登录、密码验证等操作，不应重试
 *
 * @returns RetryOptions配置对象
 */
export function createNoRetryOptions(): RetryOptions {
  return {
    maxRetries: 0,
    shouldRetry: () => false,
  };
}

/**
 * 快速重试配置（用于非关键操作）
 *
 * @param maxRetries - 最大重试次数，默认为2
 * @returns RetryOptions配置对象
 */
export function createFastRetryOptions(maxRetries: number = 2): RetryOptions {
  return {
    maxRetries,
    initialDelay: 500, // 500ms
    delayMultiplier: 1.5,
    maxDelay: 3000, // 最大3秒
    shouldRetry: (error: unknown) => {
      return isRetryablewarrenqError(error);
    },
    onRetry: (attempt: number, error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[warrenq] 快速重试 ${attempt}/${maxRetries}: ${errorMessage}`);
    },
  };
}
