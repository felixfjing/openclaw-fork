import { logger, generateCorrelationId } from "./logger.js";
import type { WizardPrompter } from "openclaw/plugin-sdk/setup";
import type { OpenClawConfig } from "openclaw/plugin-sdk/core";
import type { SecretInputMode } from "openclaw/plugin-sdk/provider-auth";
import type {
  ProviderAuthContext,
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthResult,
  ProviderCatalogContext,
  ProviderCatalogResult,
  ProviderPrepareRuntimeAuthContext,
  ProviderRuntimeModel,
} from "openclaw/plugin-sdk/provider-setup";
import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-onboard";
import {
  promptAndConfigurewarrenqAuth,
  configurewarrenqNonInteractive,
  preparewarrenqRuntimeAuth,
  buildwarrenqHeaders,
  createwarrenqChatRequest,
  type warrenqFullAuthConfig,
  warrenqAuthConfigSchema,
  tokenStorage,
} from "./warrenq-auth.js";
import {
  fetchGildataModels,
  getGildataModelDefinitions,
  convertGildataModelToModelDefinition,
  resolveGildataBaseUrl,
  GILDATA_MODEL_ALIASES,
  GILDATA_MODEL_TO_ALIAS,
  GILDATA_DEFAULT_BASE_URL,
} from "./dynamic-models.js";

const GILDATA_PROVIDER_ID = "gildata";

/**
 * 交互式认证配置
 */
export async function promptAndConfigureGildataInteractive(params: {
  config: OpenClawConfig;
  prompter?: WizardPrompter;
  secretInputMode?: SecretInputMode;
  allowSecretRefPrompt?: boolean;
}): Promise<ProviderAuthResult> {
  return await promptAndConfigurewarrenqAuth({
    config: params.config,
    prompter: params.prompter,
    secretInputMode: params.secretInputMode,
    allowSecretRefPrompt: params.allowSecretRefPrompt,
  });
}

/**
 * 非交互式配置
 */
export async function configureGildataNonInteractive(
  ctx: ProviderAuthMethodNonInteractiveContext,
): Promise<OpenClawConfig | null> {
  return await configurewarrenqNonInteractive(ctx);
}

/**
 * 提供商发现
 */
export async function discoverGildataProvider(
  ctx: ProviderCatalogContext,
): Promise<ProviderCatalogResult> {
  const correlationId = generateCorrelationId();
  const { config } = ctx;
  const providerConfig = config?.models?.providers?.gildata as warrenqFullAuthConfig | undefined;
  const warrenqEnabled = providerConfig?.autoLogin ?? false;

  logger.info("开始Gildata Provider发现流程", {
    correlationId,
    warrenqEnabled,
    hasProviderConfig: !!providerConfig,
  });

  // 如果启用了warrenq，尝试自动登录获取模型列表
  if (warrenqEnabled) {
    logger.info("使用warrenq认证模式进行Provider发现", { correlationId });

    try {
      const warrenqChatConfig: Partial<warrenqChatConfig> = {
        chatBaseUrl: providerConfig?.chatBaseUrl,
        agentId: providerConfig?.agentId,
        userId: providerConfig?.userId,
        tenantId: providerConfig?.tenantId,
        sessionId: providerConfig?.sessionId,
        queryId: providerConfig?.queryId,
        moduleId: providerConfig?.moduleId,
        contentType: providerConfig?.contentType,
      };

      logger.debug("warrenq配置参数", {
        correlationId,
        hasChatBaseUrl: !!providerConfig?.chatBaseUrl,
        hasAgentId: !!providerConfig?.agentId,
        hasUserId: !!providerConfig?.userId,
        hasTenantId: !!providerConfig?.tenantId,
      });

      // 模拟API调用获取模型列表
      const modelDefinitions = await getGildataModelDefinitions({
        baseUrl: providerConfig?.loginBaseUrl || "https://pure.warrenq.com",
        apiKey: "", // warrenq模式下不需要apiKey
        headers: {}, // 会通过请求头传递
      });

      if (modelDefinitions.length === 0) {
        logger.warn("warrenq模式下未能获取模型列表", { correlationId });
        return null;
      }

      logger.info("warrenq模式下成功获取模型列表", {
        correlationId,
        modelCount: modelDefinitions.length,
      });

      return {
        models: modelDefinitions,
        modelAliases: GILDATA_MODEL_ALIASES,
      };
    } catch (error) {
      logger.error("warrenq Provider发现失败", error as Error, { correlationId });
      return null;
    }
  }

  // 标准API Key认证模式
  logger.info("使用API Key认证模式进行Provider发现", { correlationId });

  const apiKey = providerConfig?.apiKey || process.env.GILDATA_API_TOKEN;
  if (!apiKey) {
    logger.warn("未找到API Key，跳过Provider发现", {
      correlationId,
      hasConfigKey: !!providerConfig?.apiKey,
      hasEnvKey: !!process.env.GILDATA_API_TOKEN,
    });
    return null;
  }

  logger.info("找到有效的API Key", {
    correlationId,
    source: providerConfig?.apiKey ? "config" : "environment",
  });

  const baseUrl = resolveGildataBaseUrl(providerConfig?.warrenqBaseUrl);

  try {
    const modelDefinitions = await getGildataModelDefinitions({
      baseUrl,
      apiKey,
      headers: providerConfig?.customHeaders,
    });

    if (modelDefinitions.length === 0) {
      logger.warn("获取到的模型列表为空", {
        correlationId,
        baseUrl,
      });
      return null;
    }

    logger.info("API Key模式下成功获取模型列表", {
      correlationId,
      modelCount: modelDefinitions.length,
      baseUrl,
    });

    return {
      models: modelDefinitions,
      modelAliases: GILDATA_MODEL_ALIASES,
    };
  } catch (error) {
    logger.error("Gildata Provider发现失败", error as Error, { correlationId });
    return null;
  }
}

/**
 * 准备动态模型
 */
export async function prepareGildataDynamicModels(
  ctx: ProviderPrepareDynamicModelContext,
): Promise<ProviderRuntimeModel[]> {
  const correlationId = generateCorrelationId();
  const { providerConfig, config } = ctx;
  const warrenqEnabled = providerConfig?.autoLogin ?? false;

  logger.info("开始准备Gildata动态模型", {
    correlationId,
    warrenqEnabled,
    hasProviderConfig: !!providerConfig,
  });

  let apiKey = "";
  let headers: Record<string, string> | undefined;

  if (warrenqEnabled) {
    logger.debug("使用warrenq认证模式准备动态模型", { correlationId });

    const warrenqChatConfig: Partial<warrenqChatConfig> = {
      chatBaseUrl: providerConfig?.chatBaseUrl,
      agentId: providerConfig?.agentId,
      userId: providerConfig?.userId,
      tenantId: providerConfig?.tenantId,
      sessionId: providerConfig?.sessionId,
      queryId: providerConfig?.queryId,
      moduleId: providerConfig?.moduleId,
      contentType: providerConfig?.contentType,
    };

    // 使用warrenq登录的token
    const result = await preparewarrenqRuntimeAuth(ctx);

    apiKey = result.apiKey;
    headers = result.headers;

    logger.debug("warrenq运行时认证准备完成", {
      correlationId,
      hasApiKey: !!apiKey,
      hasHeaders: !!headers,
      headerCount: headers ? Object.keys(headers).length : 0,
    });
  } else {
    logger.debug("使用API Key认证模式准备动态模型", { correlationId });

    apiKey = providerConfig?.apiKey || "";
    headers = providerConfig?.customHeaders;

    logger.debug("API Key配置准备完成", {
      correlationId,
      hasApiKey: !!apiKey,
      hasCustomHeaders: !!headers,
      headerCount: headers ? Object.keys(headers).length : 0,
    });
  }

  const baseUrl = resolveGildataBaseUrl(
    providerConfig?.warrenqBaseUrl || providerConfig?.chatBaseUrl
  );

  logger.debug("准备从API获取模型定义", {
    correlationId,
    baseUrl,
  });

  try {
    const modelDefinitions = await getGildataModelDefinitions({
      baseUrl,
      apiKey,
      headers,
    });

    const runtimeModels: ProviderRuntimeModel[] = modelDefinitions.map((modelDef) => ({
      id: modelDef.id,
      name: modelDef.name,
      ...modelDef,
    }));

    logger.info("动态模型准备完成", {
      correlationId,
      modelCount: runtimeModels.length,
    });

    return runtimeModels;
  } catch (error) {
    logger.error("Gildata动态模型准备失败", error as Error, { correlationId });
    return [];
  }
}

/**
 * 准备运行时认证
 */
export async function prepareGildataRuntimeAuth(
  ctx: ProviderPrepareRuntimeAuthContext,
): Promise<{ apiKey: string; headers?: Record<string, string> }> {
  const correlationId = generateCorrelationId();
  const { config, apiKey } = ctx;

  logger.debug("开始准备Gildata运行时认证", {
    correlationId,
    hasApiKey: !!apiKey,
  });

  const providerConfig = config?.models?.providers?.gildata;
  const warrenqEnabled = providerConfig?.autoLogin ?? false;

  if (warrenqEnabled) {
    logger.info("使用warrenq认证模式", { correlationId });
    const result = await preparewarrenqRuntimeAuth(ctx);
    logger.info("warrenq运行时认证准备完成", {
      correlationId,
      hasHeaders: !!result.headers,
    });
    return result;
  }

  logger.info("使用标准API Key认证", { correlationId });
  return {
    apiKey: apiKey,
  };
}

/**
 * 导出常量供其他模块使用
 */
export {
  GILDATA_MODEL_ALIASES,
  GILDATA_MODEL_TO_ALIAS,
  GILDATA_DEFAULT_BASE_URL,
  tokenStorage,
  warrenqAuthConfigSchema,
};
