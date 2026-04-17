/**
 * HTTP客户端工具模块
 *
 * 功能：
 * - 支持请求超时
 * - 自动取消超时请求
 * - 与性能监控集成
 * - 与缓存集成
 * - 结构化日志记录
 */

import { logger, generateCorrelationId } from "./logger.js";
import { performanceMonitor } from "./performance-monitor.js";
import { warrenqAuthError, warrenqErrorCode } from "./warrenq-auth-error.js";

/**
 * HTTP请求配置
 */
export interface HttpRequestConfig extends RequestInit {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 性能监控类型 */
  perfType?: "login" | "tenantInfo" | "api";
  /** 是否使用缓存 */
  useCache?: boolean;
  /** 缓存键生成函数 */
  cacheKeyFn?: () => string;
}

/**
 * HTTP响应类型
 */
export interface HttpResponse<T = unknown> {
  /** 响应数据 */
  data: T;
  /** 响应状态 */
  status: number;
  /** 响应头 */
  headers: Headers;
  /** 响应时间（毫秒） */
  responseTime: number;
}

/**
 * 创建带超时的fetch函数
 */
export async function fetchWithTimeout(
  url: string,
  config: HttpRequestConfig = {}
): Promise<Response> {
  const correlationId = generateCorrelationId();
  const {
    timeout = 60000, // 默认60秒超时
    perfType = "api",
    ...fetchConfig
  } = config;

  // 记录API请求
  logger.apiRequest({
    method: fetchConfig.method || "GET",
    url,
    headers: fetchConfig.headers as Record<string, string>,
    correlationId,
  });

  // 创建性能计时器
  const timer = performanceMonitor.createTimer();

  // 创建AbortController用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      signal: controller.signal,
    });

    // 清除超时定时器
    clearTimeout(timeoutId);

    // 记录响应时间
    const responseTime = timer.stop();

    // 记录成功性能指标
    if (response.ok) {
      performanceMonitor.recordSuccess(responseTime, perfType);
    } else {
      performanceMonitor.recordFailure();
    }

    // 记录API响应
    logger.apiResponse({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      duration: responseTime,
      correlationId,
    });

    return response;
  } catch (error) {
    // 清除超时定时器
    clearTimeout(timeoutId);

    // 记录失败性能指标
    performanceMonitor.recordFailure();

    logger.error("HTTP请求失败", error as Error, {
      url,
      timeout,
    }, correlationId);

    // 处理超时错误
    if (error instanceof Error && error.name === "AbortError") {
      throw warrenqAuthError.timeout(
        `请求超时（${timeout}ms）: ${url}`
      );
    }

    // 处理网络错误
    if (error instanceof Error && (error.name === "TypeError" || error.name === "NetworkError")) {
      throw warrenqAuthError.networkError(error);
    }

    // 处理其他错误
    throw warrenqAuthError.fromError(error, "HTTP请求失败");
  }
}

/**
 * 解析JSON响应
 */
export async function fetchJson<T = unknown>(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  const response = await fetchWithTimeout(url, config);

  const data = await response.json() as T;

  return {
    data,
    status: response.status,
    headers: response.headers,
    responseTime: 0, // 已在fetchWithTimeout中记录
  };
}

/**
 * 解析文本响应
 */
export async function fetchText(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<string>> {
  const response = await fetchWithTimeout(url, config);

  const data = await response.text();

  return {
    data,
    status: response.status,
    headers: response.headers,
    responseTime: 0,
  };
}

/**
 * POST请求
 */
export async function post<T = unknown>(
  url: string,
  body: BodyInit,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  return fetchJson<T>(url, {
    ...config,
    method: "POST",
    body,
  });
}

/**
 * GET请求
 */
export async function get<T = unknown>(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  return fetchJson<T>(url, {
    ...config,
    method: "GET",
  });
}

/**
 * 登录请求（30秒超时）
 */
export async function loginRequest<T = unknown>(
  url: string,
  body: BodyInit,
  config: Omit<HttpRequestConfig, "timeout" | "perfType"> = {}
): Promise<HttpResponse<T>> {
  return post<T>(url, body, {
    ...config,
    timeout: 30000, // 30秒超时
    perfType: "login",
  });
}

/**
 * 租户信息请求（15秒超时）
 */
export async function tenantInfoRequest<T = unknown>(
  url: string,
  body: BodyInit,
  config: Omit<HttpRequestConfig, "timeout" | "perfType"> = {}
): Promise<HttpResponse<T>> {
  return post<T>(url, body, {
    ...config,
    timeout: 15000, // 15秒超时
    perfType: "tenantInfo",
  });
}

/**
 * API请求（60秒超时，可配置）
 */
export async function apiRequest<T = unknown>(
  url: string,
  body: BodyInit,
  config: Omit<HttpRequestConfig, "timeout" | "perfType"> = {}
): Promise<HttpResponse<T>> {
  return post<T>(url, body, {
    ...config,
    timeout: 60000, // 60秒超时
    perfType: "api",
  });
}

/**
 * 验证响应状态
 */
export function validateResponse(
  response: Response,
  errorMessage: string = "请求失败"
): Response {
  if (!response.ok) {
    throw warrenqAuthError.fromResponse(response, errorMessage);
  }
  return response;
}

/**
 * 验证JSON响应数据
 */
export function validateJsonResponse<T>(
  response: HttpResponse<T>,
  errorMessage: string = "响应数据无效",
  validator?: (data: T) => boolean
): T {
  if (validator && !validator(response.data)) {
    throw warrenqAuthError.invalidResponse(errorMessage);
  }
  return response.data;
}
