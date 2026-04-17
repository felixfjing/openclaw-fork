import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { SecretInputMode } from "openclaw/plugin-sdk/provider-auth";
import type {
  ProviderAuthContext,
  ProviderAuthResult,
  ProviderPrepareRuntimeAuthContext,
} from "openclaw/plugin-sdk/provider-setup";
import { z } from "zod";
import { FileTokenStorage, MemoryTokenStorage, type warrenqTenantInfo } from "./warrenq-login.js";
import { randomUUID } from "node:crypto";
import { logger, generateCorrelationId } from "./logger.js";
import type { AuthEventType } from "./types.js";

/**
 * warrenq认证头部类型
 */
export interface warrenqAuthHeaders {
  "Authorization": string;
  "X-warrenq-User-Id"?: string;
  "X-warrenq-Session-Id"?: string;
  "X-warrenq-Tenant-Id"?: string;
}

/**
 * warrenq认证配置
 */
export interface warrenqAuthConfig {
  apiKey?: string;
  warrenqEnabled?: boolean;
  warrenqBaseUrl?: string;
  customHeaders?: Record<string, string>;
}

/**
 * Schema定义
 */
export const warrenqAuthConfigSchema = z.object({
  apiKey: z.string().optional(),
  warrenqEnabled: z.boolean().optional().default(false),
  warrenqBaseUrl: z.string().url().optional(),
  customHeaders: z.record(z.string(), z.string()).optional().default({}),
});

export type warrenqAuthConfigInput = z.infer<typeof warrenqAuthConfigSchema>;

/**
 * 提取warrenq系统传递的动态头部
 */
export function extractwarrenqHeaders(headers: Record<string, unknown>): warrenqAuthHeaders {
  const authHeaders: Partial<warrenqAuthHeaders> = {};

  // 从环境变量或配置中提取头部
  const authorization = headers["Authorization"] || headers["authorization"];
  if (typeof authorization === "string") {
    authHeaders["Authorization"] = authorization;
  }

  const userId = headers["X-warrenq-User-Id"] || headers["x-warrenq-user-id"];
  if (typeof userId === "string") {
    authHeaders["X-warrenq-User-Id"] = userId;
  }

  const sessionId = headers["X-warrenq-Session-Id"] || headers["x-warrenq-session-id"];
  if (typeof sessionId === "string") {
    authHeaders["X-warrenq-Session-Id"] = sessionId;
  }

  const tenantId = headers["X-warrenq-Tenant-Id"] || headers["x-warrenq-tenant-id"];
  if (typeof tenantId === "string") {
    authHeaders["X-warrenq-Tenant-Id"] = tenantId;
  }

  return authHeaders as warrenqAuthHeaders;
}

/**
 * 构建请求头部（warrenq认证）
 */
export function buildwarrenqRequestHeaders(
  config: warrenqAuthConfig,
  dynamicHeaders?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {};

  // 添加基础认证
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  // 添加warrenq动态头部
  if (dynamicHeaders) {
    Object.assign(headers, dynamicHeaders);
  }

  // 添加自定义头部
  if (config.customHeaders) {
    Object.assign(headers, config.customHeaders);
  }

  return headers;
}

/**
 * 提示并配置warrenq认证
 */
export async function promptAndConfigurewarrenqAuth(params: {
  config: OpenClawConfig;
  prompter?: any;
  secretInputMode?: SecretInputMode;
  allowSecretRefPrompt?: boolean;
}): Promise<ProviderAuthResult> {
  const correlationId = generateCorrelationId();
  const { config, prompter } = params;

  logger.debug("开始warrenq认证配置流程", { correlationId });

  // 检查是否启用了warrenq
  const providerConfig = config.models?.providers?.gildata as warrenqAuthConfig | undefined;
  const warrenqEnabled = providerConfig?.warrenqEnabled ?? false;

  logger.info("检查当前warrenq配置状态", {
    correlationId,
    warrenqEnabled,
    hasApiKey: !!providerConfig?.apiKey,
  });

  await prompter?.note(
    [
      "warrenq系统认证集成",
      "当warrenq系统启用时，以下头部将自动从系统传递：",
      "- Authorization: 用户认证令牌",
      "- X-warrenq-User-Id: 用户ID",
      "- X-warrenq-Session-Id: 会话ID",
      "- X-warrenq-Tenant-Id: 租户ID",
      "",
      "这些头部是动态的，会在每次请求时从warrenq系统获取最新值。",
    ].join("\n"),
    "warrenq认证",
  );

  // 提示是否启用warrenq
  const enablewarrenq = await prompter?.confirm({
    message: "是否启用warrenq系统认证？",
    initial: warrenqEnabled,
  });

  logger.authEvent({
    eventType: "login_attempt" as AuthEventType,
    username: enablewarrenq ? "warrenq-system" : undefined,
    success: true,
    correlationId,
  });

  if (enablewarrenq) {
    logger.info("用户选择启用warrenq系统认证", { correlationId });
    return {
      kind: "warrenq",
      warrenqEnabled: true,
    };
  }

  // 否则使用API Key认证
  logger.info("用户选择使用API Key认证", { correlationId });
  const apiKey = await prompter?.password({
    message: "输入Gildata API Key",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "API Key不能为空";
      }
      return undefined;
    },
  });

  logger.authEvent({
    eventType: "login_attempt" as AuthEventType,
    username: undefined,
    success: true,
    correlationId,
  });

  logger.info("API Key认证配置完成", {
    correlationId,
    hasApiKey: !!apiKey,
  });

  return {
    kind: "api-key",
    apiKey: apiKey,
    warrenqEnabled: false,
  };
}

/**
 * 非交互式配置
 */
export async function configurewarrenqNonInteractive(
  ctx: ProviderAuthContext,
): Promise<OpenClawConfig | null> {
  const correlationId = generateCorrelationId();
  const { config } = ctx;

  logger.debug("开始非交互式warrenq认证配置", { correlationId });

  // 检查环境变量
  const envApiKey = process.env.GILDATA_API_TOKEN;
  if (envApiKey) {
    logger.info("从环境变量GILDATA_API_TOKEN获取API Key", {
      correlationId,
      hasApiKey: true,
    });
    return config;
  }

  // 从配置中读取
  const providerConfig = config.models?.providers?.gildata as warrenqAuthConfig | undefined;
  if (providerConfig?.apiKey) {
    logger.info("从配置文件获取API Key", {
      correlationId,
      hasApiKey: true,
    });
    return config;
  }

  logger.warn("未找到有效的认证凭据", {
    correlationId,
    hasEnvVar: false,
    hasConfigKey: false,
  });

  return null;
}

/**
 * 准备运行时认证
 *
 * 从 FileTokenStorage 加载 WarrenQ 登录时保存的 access_token，
 * 将其作为 apiKey 传给 OpenClaw 核心运行时（核心会自动构造
 * Authorization: Bearer {apiKey} 头部）。同时附加 WarrenQ 聊天
 * API 所需的 X-* 自定义头部。
 */
export async function preparewarrenqRuntimeAuth(
  ctx: ProviderPrepareRuntimeAuthContext,
): Promise<{ apiKey: string; request?: { headers?: Record<string, string> } }> {
  const correlationId = generateCorrelationId();
  const { config, apiKey } = ctx;

  logger.debug("准备运行时warrenq认证", {
    correlationId,
    hasApiKey: !!apiKey,
  });

  const providerConfig = config?.models?.providers?.gildata as Record<string, unknown> | undefined;

  // 始终尝试从文件加载 WarrenQ token（无论 autoLogin 是否设置）
  // 这样即使配置中没有显式启用 autoLogin，只要用户通过 Web 登录过，
  // 运行时就能使用正确的 access_token
  try {
    const storage = new FileTokenStorage();
    const tokenInfo: warrenqTenantInfo | null = await storage.getToken();

    if (tokenInfo?.access_token) {
      const queryId = randomUUID();
      const headers: Record<string, string> = {
        "x-agent-id": (providerConfig?.agentId as string) || "gildata-claw",
        "x-module-id": (providerConfig?.moduleId as string) || "claw",
        "x-tenant-id": tokenInfo.tenantId,
        "x-user-id": tokenInfo.userId,
        "x-query-id": queryId,
        "x-session-id": tokenInfo.access_token,
      };

      logger.info("从文件加载warrenq token成功", {
        correlationId,
        userId: tokenInfo.userId,
        tenantId: tokenInfo.tenantId,
        queryId,
      });

      return {
        apiKey: tokenInfo.access_token,
        request: { headers },
      };
    }

    logger.debug("warrenq token文件为空或不存在", { correlationId });
  } catch (error) {
    logger.warn("读取warrenq token失败", {
      correlationId,
      error: (error as Error).message,
    });
  }

  // 回退：使用原始 apiKey
  logger.debug("使用默认API Key认证", { correlationId });

  return {
    apiKey: apiKey,
  };
}

/**
 * 默认Token存储实例（文件持久化）
 */
export const tokenStorage = new FileTokenStorage();
