/**
 * login-route.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLoginRoute } from "./login-route.js";
import { warrenqAuthError } from "./warrenq-auth-error.js";

// Mock warrenq-login 模块
vi.mock("./warrenq-login.js", () => ({
  createwarrenqLoginClient: vi.fn(),
}));

vi.mock("./logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    authEvent: vi.fn(),
  },
  generateCorrelationId: () => "test-correlation-id",
}));

import { createwarrenqLoginClient } from "./warrenq-login.js";

/**
 * 创建模拟的 IncomingMessage
 */
function createMockRequest(
  body: unknown,
  method = "POST",
): any {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const chunks: Buffer[] = [Buffer.from(bodyStr)];

  return {
    method,
    on(event: string, callback: (...args: any[]) => void) {
      if (event === "data") {
        callback(chunks.shift() ?? Buffer.alloc(0));
      }
      if (event === "end") {
        callback();
      }
      return this;
    },
    url: "/plugins/gildata/login",
  };
}

/**
 * 创建模拟的 ServerResponse
 */
function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    _body: "",
    setHeader(key: string, value: string) {
      res.headers[key] = value;
    },
    end(body: string) {
      res._body = body;
    },
  };
  return res;
}

describe("handleLoginRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应拒绝非 POST 请求", async () => {
    const req = createMockRequest({}, "GET");
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers["Allow"]).toBe("POST");
  });

  it("应拒绝无效的 JSON 请求体", async () => {
    const req = {
      method: "POST",
      url: "/plugins/gildata/login",
      on(event: string, callback: (...args: any[]) => void) {
        if (event === "data") {
          callback(Buffer.from("not json"));
        }
        if (event === "end") {
          callback();
        }
        return this;
      },
    };
    const res = createMockResponse();

    await handleLoginRoute(req as any, res);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("无效的请求格式");
  });

  it("应拒绝空用户名", async () => {
    const req = createMockRequest({ username: "", password: "test" });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("用户名");
  });

  it("应拒绝空密码", async () => {
    const req = createMockRequest({ username: "testuser", password: "" });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("密码");
  });

  it("应拒绝过长的用户名", async () => {
    const req = createMockRequest({
      username: "a".repeat(51),
      password: "testpass",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("50");
  });

  it("登录成功时返回 200 和用户信息", async () => {
    const mockClient = {
      loginAndGetToken: vi.fn().mockResolvedValue({
        userId: "user-123",
        tenantId: "tenant-456",
        access_token: "test-token",
      }),
    };
    vi.mocked(createwarrenqLoginClient).mockReturnValue(mockClient as any);

    const req = createMockRequest({
      username: "testuser",
      password: "testpass",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(true);
    expect(body.message).toBe("登录成功");
    expect(body.data.userId).toBe("user-123");
    expect(body.data.tenantId).toBe("tenant-456");
    // 不暴露完整 token
    expect(body.data.access_token).toBeUndefined();

    expect(mockClient.loginAndGetToken).toHaveBeenCalledWith("testuser", "testpass");
  });

  it("登录失败时返回 401", async () => {
    const mockClient = {
      loginAndGetToken: vi.fn().mockRejectedValue(
        warrenqAuthError.invalidCredentials(
          new Error("用户名或密码不正确")
        ),
      ),
    };
    vi.mocked(createwarrenqLoginClient).mockReturnValue(mockClient as any);

    const req = createMockRequest({
      username: "wrong",
      password: "wrong",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toBeTruthy();
  });

  it("非warrenqAuthError异常时返回 500", async () => {
    const mockClient = {
      loginAndGetToken: vi.fn().mockRejectedValue(
        new Error("Unexpected internal error"),
      ),
    };
    vi.mocked(createwarrenqLoginClient).mockReturnValue(mockClient as any);

    const req = createMockRequest({
      username: "user",
      password: "pass",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res._body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("服务器内部错误");
  });

  it("应支持自定义 loginBaseUrl", async () => {
    const mockClient = {
      loginAndGetToken: vi.fn().mockResolvedValue({
        userId: "u1",
        tenantId: "t1",
        access_token: "tok",
      }),
    };
    vi.mocked(createwarrenqLoginClient).mockReturnValue(mockClient as any);

    const req = createMockRequest({
      username: "user",
      password: "pass",
      loginBaseUrl: "https://custom.warrenq.com",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(createwarrenqLoginClient).toHaveBeenCalledWith({
      loginBaseUrl: "https://custom.warrenq.com",
    });
  });

  it("应 trim 用户名空格", async () => {
    const mockClient = {
      loginAndGetToken: vi.fn().mockResolvedValue({
        userId: "u1",
        tenantId: "t1",
        access_token: "tok",
      }),
    };
    vi.mocked(createwarrenqLoginClient).mockReturnValue(mockClient as any);

    const req = createMockRequest({
      username: "  testuser  ",
      password: "pass",
    });
    const res = createMockResponse();

    await handleLoginRoute(req, res);

    expect(mockClient.loginAndGetToken).toHaveBeenCalledWith("testuser", "pass");
  });
});
