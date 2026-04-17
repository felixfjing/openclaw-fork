/**
 * warrenq认证错误系统
 *
 * 提供结构化的错误处理、错误代码和用户友好的错误消息
 */

/**
 * warrenq错误代码枚举
 */
export enum warrenqErrorCode {
  /** 凭证无效 - 用户名或密码错误 */
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",

  /** 网络错误 - 连接失败或超时 */
  NETWORK_ERROR = "NETWORK_ERROR",

  /** 服务器错误 - 服务器返回5xx错误 */
  SERVER_ERROR = "SERVER_ERROR",

  /** Token过期 - access_token已失效 */
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  /** 配置无效 - 缺少必需的配置项 */
  INVALID_CONFIG = "INVALID_CONFIG",

  /** 未授权 - 401/403错误 */
  UNAUTHORIZED = "UNAUTHORIZED",

  /** Token存储失败 - 文件系统错误 */
  TOKEN_STORAGE_ERROR = "TOKEN_STORAGE_ERROR",

  /** 响应数据无效 - 无法解析服务器响应 */
  INVALID_RESPONSE = "INVALID_RESPONSE",

  /** 认证流程中断 - 用户取消或流程异常 */
  AUTH_INTERRUPTED = "AUTH_INTERRUPTED",

  /** 请求超时 - 请求超过指定时间未完成 */
  TIMEOUT = "TIMEOUT",
}

/**
 * 用户友好的错误消息映射
 */
const ERROR_MESSAGES: Record<warrenqErrorCode, string> = {
  [warrenqErrorCode.INVALID_CREDENTIALS]: "用户名或密码不正确，请检查后重试",
  [warrenqErrorCode.NETWORK_ERROR]: "网络连接失败，请检查网络设置后重试",
  [warrenqErrorCode.SERVER_ERROR]: "warrenq服务器暂时不可用，请稍后重试",
  [warrenqErrorCode.TOKEN_EXPIRED]: "登录已过期，请重新登录",
  [warrenqErrorCode.INVALID_CONFIG]: "配置信息不完整，请检查配置文件",
  [warrenqErrorCode.UNAUTHORIZED]: "无权限访问，请检查账号权限",
  [warrenqErrorCode.TOKEN_STORAGE_ERROR]: "无法保存登录凭证，请检查文件权限",
  [warrenqErrorCode.INVALID_RESPONSE]: "服务器返回的数据格式异常",
  [warrenqErrorCode.AUTH_INTERRUPTED]: "认证流程被中断",
  [warrenqErrorCode.TIMEOUT]: "请求超时，请检查网络连接或稍后重试",
};

/**
 * 是否为可重试的错误代码
 */
const RETRIABLE_ERRORS: Set<warrenqErrorCode> = new Set([
  warrenqErrorCode.NETWORK_ERROR,
  warrenqErrorCode.SERVER_ERROR,
  warrenqErrorCode.INVALID_RESPONSE,
]);

/**
 * 不应重试的HTTP状态码
 */
const NON_RETRYABLE_HTTP_CODES: Set<number> = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  422, // Unprocessable Entity
]);

/**
 * warrenq自定义错误类
 */
export class warrenqAuthError extends Error {
  readonly code: warrenqErrorCode;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly originalError?: Error;
  readonly userMessage: string;
  readonly timestamp: string;

  constructor(
    code: warrenqErrorCode,
    message?: string,
    options?: {
      httpStatus?: number;
      originalError?: Error;
      retryable?: boolean;
    }
  ) {
    // 用户友好的消息作为主消息
    const userMessage = message || ERROR_MESSAGES[code];
    super(userMessage);

    this.name = "warrenqAuthError";
    this.code = code;
    this.httpStatus = options?.httpStatus;
    this.originalError = options?.originalError;
    this.userMessage = userMessage;
    this.timestamp = new Date().toISOString();

    // 自动判断是否可重试
    if (options?.retryable !== undefined) {
      this.retryable = options.retryable;
    } else if (options?.httpStatus !== undefined) {
      // 根据HTTP状态码判断
      this.retryable = !NON_RETRYABLE_HTTP_CODES.has(options.httpStatus);
    } else {
      // 根据错误代码判断
      this.retryable = RETRIABLE_ERRORS.has(code);
    }

    // 保持正确的原型链
    Object.setPrototypeOf(this, warrenqAuthError.prototype);

    // 保留原始错误的堆栈跟踪
    if (options?.originalError?.stack) {
      this.stack = `${this.stack}\n\nCaused by:\n${options.originalError.stack}`;
    }
  }

  /**
   * 创建凭证无效错误
   */
  static invalidCredentials(originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.INVALID_CREDENTIALS,
      undefined,
      {
        originalError,
        retryable: false,
      }
    );
  }

  /**
   * 创建网络错误
   */
  static networkError(originalError?: Error, httpStatus?: number): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.NETWORK_ERROR,
      undefined,
      {
        httpStatus,
        originalError,
        retryable: true,
      }
    );
  }

  /**
   * 创建服务器错误
   */
  static serverError(httpStatus: number, originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.SERVER_ERROR,
      `服务器返回错误状态: ${httpStatus}`,
      {
        httpStatus,
        originalError,
        retryable: true,
      }
    );
  }

  /**
   * 创建Token过期错误
   */
  static tokenExpired(originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.TOKEN_EXPIRED,
      undefined,
      {
        originalError,
        retryable: false,
      }
    );
  }

  /**
   * 创建配置无效错误
   */
  static invalidConfig(message: string, originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.INVALID_CONFIG,
      message,
      {
        originalError,
        retryable: false,
      }
    );
  }

  /**
   * 创建未授权错误
   */
  static unauthorized(httpStatus: number, originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.UNAUTHORIZED,
      `无权限访问 (HTTP ${httpStatus})`,
      {
        httpStatus,
        originalError,
        retryable: false,
      }
    );
  }

  /**
   * 创建Token存储错误
   */
  static tokenStorageError(originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.TOKEN_STORAGE_ERROR,
      undefined,
      {
        originalError,
        retryable: false,
      }
    );
  }

  /**
   * 创建响应数据无效错误
   */
  static invalidResponse(message: string, originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.INVALID_RESPONSE,
      message,
      {
        originalError,
        retryable: true,
      }
    );
  }

  /**
   * 创建超时错误
   */
  static timeout(message: string, originalError?: Error): warrenqAuthError {
    return new warrenqAuthError(
      warrenqErrorCode.TIMEOUT,
      message,
      {
        originalError,
        retryable: true,
      }
    );
  }

  /**
   * 从HTTP响应创建错误
   */
  static fromResponse(
    response: Response,
    operation: string
  ): warrenqAuthError {
    const status = response.status;

    // 认证错误（不应重试）
    if (status === 401 || status === 403) {
      return warrenqAuthError.unauthorized(status);
    }

    // 客户端错误（不应重试）
    if (status >= 400 && status < 500) {
      return warrenqAuthError.invalidConfig(
        `${operation}失败: HTTP ${status} ${response.statusText}`
      );
    }

    // 服务器错误（可重试）
    if (status >= 500) {
      return warrenqAuthError.serverError(status);
    }

    // 其他错误
    return warrenqAuthError.networkError(undefined, status);
  }

  /**
   * 判断是否为warrenqAuthError
   */
  static iswarrenqAuthError(error: unknown): error is warrenqAuthError {
    return error instanceof warrenqAuthError;
  }

  /**
   * 从任意错误创建warrenqAuthError
   */
  static fromError(error: unknown, context?: string): warrenqAuthError {
    if (warrenqAuthError.iswarrenqAuthError(error)) {
      return error;
    }

    if (error instanceof Error) {
      const message = context ? `${context}: ${error.message}` : error.message;

      // 根据错误消息猜测错误类型
      if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
        return warrenqAuthError.networkError(error);
      }

      if (message.includes("401") || message.includes("403")) {
        return warrenqAuthError.unauthorized(401, error);
      }

      if (message.includes("credentials") || message.includes("password") || message.includes("username")) {
        return warrenqAuthError.invalidCredentials(error);
      }

      if (message.includes("token") && (message.includes("expired") || message.includes("invalid"))) {
        return warrenqAuthError.tokenExpired(error);
      }

      if (message.includes("config") || message.includes("配置")) {
        return warrenqAuthError.invalidConfig(message, error);
      }

      // 默认作为网络错误
      return warrenqAuthError.networkError(error);
    }

    return new warrenqAuthError(
      warrenqErrorCode.INVALID_RESPONSE,
      context || "未知错误"
    );
  }

  /**
   * 获取调试信息
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      code: this.code,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      timestamp: this.timestamp,
      originalError: this.originalError?.message,
      originalErrorStack: this.originalError?.stack,
    };
  }

  /**
   * 转换为日志记录
   */
  toLog(): string {
    return JSON.stringify({
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      timestamp: this.timestamp,
      originalError: this.originalError?.message,
    }, null, 2);
  }
}
