/**
 * Gildata Provider 结构化日志模块
 *
 * 提供结构化日志记录功能，支持：
 * - 多级别日志（debug, info, warn, error）
 * - 敏感数据脱敏
 * - 关联ID跟踪
 * - 结构化JSON输出
 * - Token存储操作日志
 * - API请求/响应日志
 * - 认证事件日志
 */

import type {
  ApiRequestLogData,
  ApiResponseLogData,
  AuthEventLogData,
  CorrelationId,
  LogEntry,
  LoggerConfig,
  RedactionRule,
} from "./types.js";
import { LogLevel } from "./types.js";

const SUBSYSTEM = "gildata-provider";

/**
 * 生成关联ID
 */
export function generateCorrelationId(): CorrelationId {
  return `gildata-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 默认脱敏规则
 */
const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // 密码字段
  { pattern: /"password"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },
  { pattern: /"passwd"\s*:\s*"[^"]*"/gi, replacement: '"passwd":"[REDACTED]"' },
  { pattern: /"pwd"\s*:\s*"[^"]*"/gi, replacement: '"pwd":"[REDACTED]"' },
  // Token字段
  { pattern: /"token"\s*:\s*"[^"]*"/gi, replacement: '"token":"[REDACTED]"' },
  { pattern: /"access_token"\s*:\s*"[^"]*"/gi, replacement: '"access_token":"[REDACTED]"' },
  { pattern: /"refresh_token"\s*:\s*"[^"]*"/gi, replacement: '"refresh_token":"[REDACTED]"' },
  // API Key字段
  { pattern: /"apiKey"\s*:\s*"[^"]*"/gi, replacement: '"apiKey":"[REDACTED]"' },
  { pattern: /"api_key"\s*:\s*"[^"]*"/gi, replacement: '"api_key":"[REDACTED]"' },
  { pattern: /"api-token"\s*:\s*"[^"]*"/gi, replacement: '"api-token":"[REDACTED]"' },
  // Authorization头
  {
    pattern: /"Authorization"\s*:\s*"[^"]*"/gi,
    replacement: '"Authorization":"[REDACTED]"',
  },
  // 敏感环境变量
  { pattern: /GILDATA_API_TOKEN=[^&\s]+/gi, replacement: "GILDATA_API_TOKEN=[REDACTED]" },
  { pattern: /warrenq_PASSWORD=[^&\s]+/gi, replacement: "warrenq_PASSWORD=[REDACTED]" },
  // 私钥
  { pattern: /"private_key"\s*:\s*"[^"]*"/gi, replacement: '"private_key":"[REDACTED]"' },
  { pattern: /"privateKey"\s*:\s*"[^"]*"/gi, replacement: '"privateKey":"[REDACTED]"' },
  // 会话ID（部分脱敏）
  {
    pattern: /"session_id"\s*:\s*"([^"]+)"/gi,
    replacement: '"session_id":"$1..."',
  },
  {
    pattern: /"sessionId"\s*:\s*"([^"]+)"/gi,
    replacement: '"sessionId":"$1..."',
  },
];

/**
 * 脱敏敏感数据
 */
export function redactSensitiveData(data: string): string {
  let result = data;
  for (const rule of DEFAULT_REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

/**
 * 脱敏对象中的敏感数据
 */
export function redactSensitiveObject(data: unknown): unknown {
  if (typeof data === "string") {
    return redactSensitiveData(data);
  }
  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data)) {
      return data.map(redactSensitiveObject);
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // 检查是否是敏感字段
      const isSensitive = /^(password|token|apiKey|api_key|access_token|refresh_token|private_key|secret)$/i.test(key);
      if (isSensitive && typeof value === "string") {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveObject(value);
      }
    }
    return result;
  }
  return data;
}

/**
 * 脱敏用户名（保留首尾字符）
 */
export function redactUsername(username: string): string {
  if (!username || username.length <= 1) {
    return "***";
  }
  if (username.length === 2) {
    return username; // 保留完整的2字符用户名
  }
  const first = username.charAt(0);
  const last = username.charAt(username.length - 1);
  const masked = "*".repeat(Math.min(username.length - 2, 8));
  return `${first}${masked}${last}`;
}

/**
 * 日志配置
 */
let loggerConfig: LoggerConfig = {
  level: (process.env.GILDATA_LOG_LEVEL as LogLevel) || LogLevel.INFO,
  enabled: process.env.GILDATA_LOG_ENABLED !== "false",
  includeCorrelationId: true,
  logToFile: false,
  logToConsole: process.env.GILDATA_LOG_CONSOLE === "true",
};

/**
 * 设置日志配置
 */
export function setLoggerConfig(config: Partial<LoggerConfig>): void {
  loggerConfig = { ...loggerConfig, ...config };
}

/**
 * 获取日志配置
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...loggerConfig };
}

/**
 * 日志级别优先级
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * 检查是否应该记录此级别的日志
 */
function shouldLog(level: LogLevel): boolean {
  if (!loggerConfig.enabled) {
    return false;
  }
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[loggerConfig.level];
}

/**
 * 格式化时间戳
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 构建日志条目
 */
function buildLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error,
  correlationId?: CorrelationId,
): LogEntry {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    subsystem: SUBSYSTEM,
    message,
  };

  if (loggerConfig.includeCorrelationId && correlationId) {
    entry.correlationId = correlationId;
  }

  if (data) {
    entry.data = redactSensitiveObject(data) as Record<string, unknown>;
  }

  if (error) {
    entry.error = {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };
  }

  return entry;
}

/**
 * 输出日志到控制台
 */
function outputToConsole(entry: LogEntry): void {
  if (!loggerConfig.logToConsole) {
    return;
  }

  const logFn = console[entry.level] || console.log;
  const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.subsystem}]`;

  if (entry.correlationId) {
    logFn(`${logMessage} [${entry.correlationId}] ${entry.message}`);
  } else {
    logFn(`${logMessage} ${entry.message}`);
  }

  if (entry.data) {
    logFn("Data:", JSON.stringify(entry.data, null, 2));
  }

  if (entry.error) {
    logFn("Error:", entry.error.message);
    if (entry.error.stack) {
      logFn("Stack:", entry.error.stack);
    }
  }
}

/**
 * 输出日志到文件
 */
function outputToFile(entry: LogEntry): void {
  if (!loggerConfig.logToFile || !loggerConfig.filePath) {
    return;
  }

  try {
    const fs = require("node:fs");
    const path = require("node:path");

    // 确保目录存在
    const dir = path.dirname(loggerConfig.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const logLine = JSON.stringify(entry) + "\n";
    fs.appendFileSync(loggerConfig.filePath, logLine, "utf8");
  } catch (err) {
    // 静默失败，避免日志输出导致程序崩溃
    console.error("Failed to write log to file:", err);
  }
}

/**
 * 核心日志函数
 */
function log(
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>,
  error?: Error,
  correlationId?: CorrelationId,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = buildLogEntry(level, message, data, error, correlationId);
  outputToConsole(entry);
  outputToFile(entry);
}

/**
 * 结构化日志API
 */
export const logger = {
  debug: (message: string, data?: Record<string, unknown>, correlationId?: CorrelationId): void => {
    log(LogLevel.DEBUG, message, data, undefined, correlationId);
  },

  info: (message: string, data?: Record<string, unknown>, correlationId?: CorrelationId): void => {
    log(LogLevel.INFO, message, data, undefined, correlationId);
  },

  warn: (message: string, data?: Record<string, unknown>, error?: Error, correlationId?: CorrelationId): void => {
    log(LogLevel.WARN, message, data, error, correlationId);
  },

  error: (message: string, error: Error, data?: Record<string, unknown>, correlationId?: CorrelationId): void => {
    log(LogLevel.ERROR, message, data, error, correlationId);
  },

  /**
   * 记录API请求
   */
  apiRequest: (requestData: ApiRequestLogData): void => {
    const { method, url, headers, body, correlationId } = requestData;
    const data = {
      method,
      url: redactSensitiveData(url),
      headers: redactSensitiveObject(headers),
      body: body ? redactSensitiveObject(body) : undefined,
    };
    logger.debug("API Request", data, correlationId);
  },

  /**
   * 记录API响应
   */
  apiResponse: (responseData: ApiResponseLogData): void => {
    const { status, headers, body, correlationId, duration } = responseData;
    const data = {
      status,
      headers: redactSensitiveObject(headers),
      body: body ? redactSensitiveObject(body) : undefined,
      duration,
    };
    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    log(level, "API Response", data, undefined, correlationId);
  },

  /**
   * 记录认证事件
   */
  authEvent: (eventData: AuthEventLogData): void => {
    const { eventType, username, userId, tenantId, success, error, correlationId } = eventData;
    const data = {
      eventType,
      username: username ? redactUsername(username) : undefined,
      userId,
      tenantId,
      success,
      error,
    };

    const message = `Auth Event: ${eventType}`;
    const level = success === false ? LogLevel.WARN : LogLevel.INFO;

    log(level, message, data, undefined, correlationId);
  },

  /**
   * 创建带有固定correlationId的子logger
   */
  withCorrelationId: (correlationId: CorrelationId) => {
    return {
      debug: (message: string, data?: Record<string, unknown>): void => {
        logger.debug(message, data, correlationId);
      },
      info: (message: string, data?: Record<string, unknown>): void => {
        logger.info(message, data, correlationId);
      },
      warn: (message: string, data?: Record<string, unknown>, error?: Error): void => {
        logger.warn(message, data, error, correlationId);
      },
      error: (message: string, error: Error, data?: Record<string, unknown>): void => {
        logger.error(message, error, data, correlationId);
      },
      apiRequest: (requestData: Omit<ApiRequestLogData, "correlationId">): void => {
        logger.apiRequest({ ...requestData, correlationId });
      },
      apiResponse: (responseData: Omit<ApiResponseLogData, "correlationId">): void => {
        logger.apiResponse({ ...responseData, correlationId });
      },
      authEvent: (eventData: Omit<AuthEventLogData, "correlationId">): void => {
        logger.authEvent({ ...eventData, correlationId });
      },
      getCorrelationId: (): CorrelationId => correlationId,
    };
  },
};

/**
 * 导出默认logger实例
 */
export default logger;
