/**
 * warrenq认证错误处理测试
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  warrenqAuthError,
  warrenqErrorCode,
} from "./warrenq-auth-error.js";
import { withRetry, createRetryOptions, createNoRetryOptions } from "./retry-utils.js";

describe("warrenqAuthError", () => {
  describe("错误类创建", () => {
    it("应该创建基本的错误实例", () => {
      const error = new warrenqAuthError(
        warrenqErrorCode.INVALID_CREDENTIALS,
        "测试错误消息"
      );

      expect(error.name).toBe("warrenqAuthError");
      expect(error.code).toBe(warrenqErrorCode.INVALID_CREDENTIALS);
      expect(error.message).toBe("测试错误消息");
      expect(error.userMessage).toBe("测试错误消息");
      expect(error.retryable).toBe(false);
      expect(error.timestamp).toBeDefined();
    });

    it("应该包含原始错误信息", () => {
      const originalError = new Error("原始错误");
      const error = new warrenqAuthError(
        warrenqErrorCode.NETWORK_ERROR,
        "网络错误",
        { originalError }
      );

      expect(error.originalError).toBe(originalError);
      expect(error.stack).toContain("原始错误");
    });

    it("应该根据HTTP状态码判断是否可重试", () => {
      const retryableError = new warrenqAuthError(
        warrenqErrorCode.NETWORK_ERROR,
        "网络错误",
        { httpStatus: 500 }
      );

      const nonRetryableError = new warrenqAuthError(
        warrenqErrorCode.UNAUTHORIZED,
        "未授权",
        { httpStatus: 401 }
      );

      expect(retryableError.retryable).toBe(true);
      expect(nonRetryableError.retryable).toBe(false);
    });
  });

  describe("静态工厂方法", () => {
    it("invalidCredentials应该创建凭证无效错误", () => {
      const error = warrenqAuthError.invalidCredentials();

      expect(error.code).toBe(warrenqErrorCode.INVALID_CREDENTIALS);
      expect(error.userMessage).toBe("用户名或密码不正确，请检查后重试");
      expect(error.retryable).toBe(false);
    });

    it("networkError应该创建网络错误", () => {
      const error = warrenqAuthError.networkError();

      expect(error.code).toBe(warrenqErrorCode.NETWORK_ERROR);
      expect(error.userMessage).toBe("网络连接失败，请检查网络设置后重试");
      expect(error.retryable).toBe(true);
    });

    it("serverError应该创建服务器错误", () => {
      const error = warrenqAuthError.serverError(503);

      expect(error.code).toBe(warrenqErrorCode.SERVER_ERROR);
      expect(error.httpStatus).toBe(503);
      expect(error.retryable).toBe(true);
    });

    it("tokenExpired应该创建Token过期错误", () => {
      const error = warrenqAuthError.tokenExpired();

      expect(error.code).toBe(warrenqErrorCode.TOKEN_EXPIRED);
      expect(error.userMessage).toBe("登录已过期，请重新登录");
      expect(error.retryable).toBe(false);
    });

    it("invalidConfig应该创建配置无效错误", () => {
      const error = warrenqAuthError.invalidConfig("缺少必需的配置");

      expect(error.code).toBe(warrenqErrorCode.INVALID_CONFIG);
      expect(error.message).toBe("缺少必需的配置");
      expect(error.retryable).toBe(false);
    });

    it("unauthorized应该创建未授权错误", () => {
      const error = warrenqAuthError.unauthorized(403);

      expect(error.code).toBe(warrenqErrorCode.UNAUTHORIZED);
      expect(error.httpStatus).toBe(403);
      expect(error.retryable).toBe(false);
    });

    it("tokenStorageError应该创建Token存储错误", () => {
      const error = warrenqAuthError.tokenStorageError();

      expect(error.code).toBe(warrenqErrorCode.TOKEN_STORAGE_ERROR);
      expect(error.retryable).toBe(false);
    });

    it("invalidResponse应该创建响应数据无效错误", () => {
      const error = warrenqAuthError.invalidResponse("无法解析JSON");

      expect(error.code).toBe(warrenqErrorCode.INVALID_RESPONSE);
      expect(error.retryable).toBe(true);
    });
  });

  describe("fromResponse方法", () => {
    it("应该将401转换为未授权错误", () => {
      const response = { status: 401, statusText: "Unauthorized" } as Response;
      const error = warrenqAuthError.fromResponse(response, "测试操作");

      expect(error.code).toBe(warrenqErrorCode.UNAUTHORIZED);
      expect(error.httpStatus).toBe(401);
      expect(error.retryable).toBe(false);
    });

    it("应该将403转换为未授权错误", () => {
      const response = { status: 403, statusText: "Forbidden" } as Response;
      const error = warrenqAuthError.fromResponse(response, "测试操作");

      expect(error.code).toBe(warrenqErrorCode.UNAUTHORIZED);
      expect(error.httpStatus).toBe(403);
      expect(error.retryable).toBe(false);
    });

    it("应该将5xx转换为服务器错误", () => {
      const response = { status: 502, statusText: "Bad Gateway" } as Response;
      const error = warrenqAuthError.fromResponse(response, "测试操作");

      expect(error.code).toBe(warrenqErrorCode.SERVER_ERROR);
      expect(error.httpStatus).toBe(502);
      expect(error.retryable).toBe(true);
    });

    it("应该将4xx转换为配置错误", () => {
      const response = { status: 400, statusText: "Bad Request" } as Response;
      const error = warrenqAuthError.fromResponse(response, "测试操作");

      expect(error.code).toBe(warrenqErrorCode.INVALID_CONFIG);
      expect(error.retryable).toBe(false);
    });
  });

  describe("fromError方法", () => {
    it("应该从普通Error创建warrenqAuthError", () => {
      const originalError = new Error("网络连接失败");
      const error = warrenqAuthError.fromError(originalError);

      expect(error).toBeInstanceOf(warrenqAuthError);
      expect(error.originalError).toBe(originalError);
      expect(error.code).toBe(warrenqErrorCode.NETWORK_ERROR);
    });

    it("应该识别warrenqAuthError并直接返回", () => {
      const originalError = warrenqAuthError.invalidCredentials();
      const error = warrenqAuthError.fromError(originalError);

      expect(error).toBe(originalError);
    });

    it("应该根据错误消息猜测错误类型", () => {
      const error1 = warrenqAuthError.fromError(new Error("401 Unauthorized"));
      expect(error1.code).toBe(warrenqErrorCode.UNAUTHORIZED);

      const error2 = warrenqAuthError.fromError(
        new Error("Invalid credentials")
      );
      expect(error2.code).toBe(warrenqErrorCode.INVALID_CREDENTIALS);

      const error3 = warrenqAuthError.fromError(
        new Error("Token expired")
      );
      expect(error3.code).toBe(warrenqErrorCode.TOKEN_EXPIRED);
    });
  });

  describe("iswarrenqAuthError方法", () => {
    it("应该正确识别warrenqAuthError", () => {
      const warrenqError = warrenqAuthError.invalidCredentials();
      expect(warrenqAuthError.iswarrenqAuthError(warrenqError)).toBe(true);
      expect(warrenqAuthError.iswarrenqAuthError(new Error())).toBe(false);
      expect(warrenqAuthError.iswarrenqAuthError(null)).toBe(false);
      expect(warrenqAuthError.iswarrenqAuthError(undefined)).toBe(false);
    });
  });

  describe("getDebugInfo方法", () => {
    it("应该返回完整的调试信息", () => {
      const originalError = new Error("原始错误");
      const error = new warrenqAuthError(
        warrenqErrorCode.NETWORK_ERROR,
        "测试错误",
        { httpStatus: 500, originalError }
      );

      const debugInfo = error.getDebugInfo();

      expect(debugInfo).toEqual({
        code: warrenqErrorCode.NETWORK_ERROR,
        httpStatus: 500,
        retryable: true,
        timestamp: error.timestamp,
        originalError: "原始错误",
        originalErrorStack: originalError.stack,
      });
    });
  });

  describe("toLog方法", () => {
    it("应该返回可JSON化的日志对象", () => {
      const error = warrenqAuthError.invalidCredentials();

      const log = error.toLog();
      const parsed = JSON.parse(log);

      expect(parsed.name).toBe("warrenqAuthError");
      expect(parsed.code).toBe(warrenqErrorCode.INVALID_CREDENTIALS);
      expect(parsed.retryable).toBe(false);
      expect(parsed.timestamp).toBeDefined();
    });
  });
});

describe("withRetry函数", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("应该在第一次尝试成功时返回结果", async () => {
    const mockFn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(mockFn, { maxRetries: 3 });

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("应该在可重试错误时进行重试", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(
        new warrenqAuthError(warrenqErrorCode.NETWORK_ERROR, "网络错误")
      )
      .mockResolvedValue("success");

    const onRetry = vi.fn();

    const result = await withRetry(mockFn, {
      maxRetries: 3,
      initialDelay: 100,
      onRetry,
    });

    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("应该在达到最大重试次数后抛出错误", async () => {
    const mockFn = vi.fn().mockRejectedValue(
      new warrenqAuthError(warrenqErrorCode.NETWORK_ERROR, "网络错误")
    );

    const options = createRetryOptions(3);

    await expect(withRetry(mockFn, options)).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(4); // 1次初始 + 3次重试
  });

  it("应该使用指数退避计算延迟", async () => {
    const mockFn = vi
      .fn()
      .mockRejectedValueOnce(
        new warrenqAuthError(warrenqErrorCode.NETWORK_ERROR, "网络错误")
      )
      .mockRejectedValueOnce(
        new warrenqAuthError(warrenqErrorCode.NETWORK_ERROR, "网络错误")
      )
      .mockResolvedValue("success");

    const start = Date.now();
    const result = await withRetry(mockFn, {
      maxRetries: 3,
      initialDelay: 100,
      delayMultiplier: 2,
    });
    const end = Date.now();

    expect(result).toBe("success");
    // 第一次重试延迟100ms，第二次延迟200ms，总共约300ms
    expect(end - start).toBeGreaterThanOrEqual(300);
    expect(end - start).toBeLessThan(500); // 留一些余量
  });

  it("不应该对不可重试的错误进行重试", async () => {
    const mockFn = vi.fn().mockRejectedValue(
      new warrenqAuthError(warrenqErrorCode.INVALID_CREDENTIALS, "凭证错误")
    );

    await expect(withRetry(mockFn, { maxRetries: 3 })).rejects.toThrow();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("应该调用shouldRetry自定义函数", async () => {
    const mockFn = vi.fn().mockRejectedValue(new Error("普通错误"));
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(withRetry(mockFn, { shouldRetry, maxRetries: 3 })).rejects.toThrow();
    expect(shouldRetry).toHaveBeenCalled();
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe("Retry配置工厂", () => {
  it("createRetryOptions应该返回默认配置", () => {
    const options = createRetryOptions();

    expect(options.maxRetries).toBe(3);
    expect(options.initialDelay).toBe(1000);
    expect(options.delayMultiplier).toBe(2);
    expect(options.maxDelay).toBe(10000);
    expect(typeof options.shouldRetry).toBe("function");
  });

  it("createRetryOptions应该接受自定义重试次数", () => {
    const options = createRetryOptions(5);

    expect(options.maxRetries).toBe(5);
  });

  it("createNoRetryOptions应该返回不重试的配置", () => {
    const options = createNoRetryOptions();

    expect(options.maxRetries).toBe(0);
    expect(options.shouldRetry).toBeDefined();
  });

  it("createFastRetryOptions应该返回快速重试配置", () => {
    const options = createFastRetryOptions(2);

    expect(options.maxRetries).toBe(2);
    expect(options.initialDelay).toBe(500);
    expect(options.delayMultiplier).toBe(1.5);
    expect(options.maxDelay).toBe(3000);
  });
});
