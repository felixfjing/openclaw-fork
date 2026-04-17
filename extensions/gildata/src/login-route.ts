/**
 * Warrenq Web登录后端路由
 *
 * 处理 POST /plugins/gildata/login 请求，
 * 作为浏览器与Warrenq API之间的代理，避免CORS问题。
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { createwarrenqLoginClient, type warrenqTenantInfo } from "./warrenq-login.js";
import { warrenqAuthError } from "./warrenq-auth-error.js";
import { logger, generateCorrelationId } from "./logger.js";

/**
 * 登录请求体 schema
 */
interface LoginRequestBody {
  username: string;
  password: string;
  loginBaseUrl?: string;
}

/**
 * 登录响应格式
 */
interface LoginResponseBody {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    tenantId: string;
  };
}

/**
 * 从 IncomingMessage 中读取 JSON 请求体
 */
function readJsonBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

/**
 * 发送 JSON 响应
 */
function sendJson(res: ServerResponse, statusCode: number, body: LoginResponseBody): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * Warrenq 登录 HTTP 路由处理器
 *
 * 接收前端发送的用户名/密码，通过后端代理调用 Warrenq API，
 * 完成认证后将 Token 保存到文件系统。
 */
export async function handleLoginRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const correlationId = generateCorrelationId();

  // 仅允许 POST 方法
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end("Method Not Allowed");
    return true;
  }

  try {
    // 解析请求体
    const rawBody = await readJsonBody(req);
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBody);
    } catch {
      sendJson(res, 400, {
        success: false,
        message: "无效的请求格式",
      });
      return true;
    }

    // 验证输入
    const { username, password, loginBaseUrl } = parsed as LoginRequestBody;

    if (!username || typeof username !== "string" || username.trim().length === 0) {
      sendJson(res, 400, {
        success: false,
        message: "用户名不能为空",
      });
      return true;
    }

    if (!password || typeof password !== "string" || password.length === 0) {
      sendJson(res, 400, {
        success: false,
        message: "密码不能为空",
      });
      return true;
    }

    if (username.length > 50) {
      sendJson(res, 400, {
        success: false,
        message: "用户名不能超过50个字符",
      });
      return true;
    }

    if (password.length > 100) {
      sendJson(res, 400, {
        success: false,
        message: "密码长度超出限制",
      });
      return true;
    }

    logger.info("收到Web登录请求", {
      correlationId,
      username: username.trim(),
      hasCustomBaseUrl: !!loginBaseUrl,
    });

    // 创建登录客户端并执行登录
    const client = createwarrenqLoginClient({
      loginBaseUrl: loginBaseUrl || "https://pure.warrenq.com",
    });

    const tenantInfo: warrenqTenantInfo = await client.loginAndGetToken(
      username.trim(),
      password,
    );

    logger.info("Web登录成功", {
      correlationId,
      userId: tenantInfo.userId,
      tenantId: tenantInfo.tenantId,
    });

    // 返回成功响应（不暴露完整 token）
    sendJson(res, 200, {
      success: true,
      message: "登录成功",
      data: {
        userId: tenantInfo.userId,
        tenantId: tenantInfo.tenantId,
      },
    });

    return true;
  } catch (error) {
    logger.error("Web登录失败", error as Error, { correlationId });

    // 根据 error 类型返回用户友好的错误消息
    if (warrenqAuthError.iswarrenqAuthError(error)) {
      const errorMessage = (error as Error).message || "认证失败";
      sendJson(res, 401, {
        success: false,
        message: errorMessage,
      });
      return true;
    }

    sendJson(res, 500, {
      success: false,
      message: "服务器内部错误，请稍后重试",
    });
    return true;
  }
}
