/**
 * Gildata Provider 类型定义
 */

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 关联ID类型（用于跟踪请求链）
 */
export type CorrelationId = string;

/**
 * 日志条目结构
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  subsystem: string;
  correlationId?: CorrelationId;
  message: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  includeCorrelationId: boolean;
  logToFile: boolean;
  logToConsole: boolean;
  filePath?: string;
}

/**
 * 脱敏规则
 */
export interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * API请求日志数据
 */
export interface ApiRequestLogData {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  correlationId: CorrelationId;
}

/**
 * API响应日志数据
 */
export interface ApiResponseLogData {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  correlationId: CorrelationId;
  duration?: number;
}

/**
 * 认证事件类型
 */
export enum AuthEventType {
  LOGIN_ATTEMPT = "login_attempt",
  LOGIN_SUCCESS = "login_success",
  LOGIN_FAILURE = "login_failure",
  TOKEN_REFRESH = "token_refresh",
  TOKEN_STORE = "token_store",
  TOKEN_RETRIEVE = "token_retrieve",
  LOGOUT = "logout",
}

/**
 * 认证事件日志数据
 */
export interface AuthEventLogData {
  eventType: AuthEventType;
  username?: string; // 已脱敏
  userId?: string;
  tenantId?: string;
  success?: boolean;
  error?: string;
  correlationId: CorrelationId;
}
