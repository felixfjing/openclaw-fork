import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-onboard";
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk/ssrf-runtime";
import { z } from "zod";
import { logger, generateCorrelationId } from "./logger.js";

/**
 * Gildata API响应类型
 */
interface GildataModelResponse {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  context_length?: number;
  max_tokens?: number;
  capabilities?: string[];
  pricing?: {
    input: number;
    output: number;
    currency?: string;
  };
}

interface GildataModelsResponse {
  models: GildataModelResponse[];
  total?: number;
}

/**
 * 模型别名映射
 */
export const GILDATA_MODEL_ALIASES: Record<string, string> = {
  "qwen-plus": "qwen-plus",
  "qwen2-72b": "qwen2-72b-instruct-aliyun",
  "qwen-max": "qwen-max-latest",
  "qwen-plus-aliyun": "qwen-plus-latest-aliyun",
  "qwen-plus-latest": "qwen-plus-latest",
  "deepseek-r1": "deepseek-r1",
};

/**
 * 反向映射（实际模型到别名）
 */
export const GILDATA_MODEL_TO_ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(GILDATA_MODEL_ALIASES).map(([alias, model]) => [model, alias])
);

/**
 * Gildata API基础URL
 */
export const GILDATA_DEFAULT_BASE_URL = "https://api.gildata.com";

/**
 * 解析Gildata API基础URL
 */
export function resolveGildataBaseUrl(baseUrl?: string): string {
  if (!baseUrl || baseUrl.trim().length === 0) {
    return GILDATA_DEFAULT_BASE_URL;
  }
  return baseUrl.replace(/\/+$/, "");
}

/**
 * 解析模型ID（支持别名）
 */
export function resolveGildataModelId(modelId: string): string {
  // 检查是否是别名
  const resolvedModel = GILDATA_MODEL_ALIASES[modelId];
  if (resolvedModel) {
    return resolvedModel;
  }
  return modelId;
}

/**
 * 获取模型显示名称
 */
export function getGildataModelDisplayName(modelId: string): string {
  // 返回别名（如果有）
  return GILDATA_MODEL_TO_ALIAS[modelId] || modelId;
}

/**
 * 获取所有可用的模型别名
 */
export function getGildataModelAliases(): Record<string, string> {
  return { ...GILDATA_MODEL_ALIASES };
}

/**
 * 从Gildata API获取模型列表
 */
export async function fetchGildataModels(params: {
  baseUrl?: string;
  apiKey: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}): Promise<{ reachable: boolean; models: GildataModelResponse[]; error?: string }> {
  const correlationId = generateCorrelationId();
  const baseUrl = resolveGildataBaseUrl(params.baseUrl);
  const timeoutMs = params.timeoutMs ?? 10000;
  const startTime = Date.now();

  logger.info("开始获取Gildata模型列表", {
    correlationId,
    baseUrl,
    timeoutMs,
    hasApiKey: !!params.apiKey,
    hasCustomHeaders: !!params.headers,
  });

  // 记录请求
  logger.apiRequest({
    method: "GET",
    url: `${baseUrl}/v1/models`,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.apiKey.substring(0, 10)}...`,
      ...params.headers,
    },
    correlationId,
  });

  try {
    const { response, release } = await fetchWithSsrFGuard({
      url: `${baseUrl}/v1/models`,
      init: {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${params.apiKey}`,
          ...params.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
      policy: undefined,
      auditContext: "gildata-provider-model-fetch",
    });

    const duration = Date.now() - startTime;

    try {
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        // 记录错误响应
        logger.apiResponse({
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: { error: errorText },
          correlationId,
          duration,
        });

        logger.warn("获取模型列表失败", {
          correlationId,
          status: response.status,
          error: errorText,
          duration,
        });

        return {
          reachable: true,
          models: [],
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as GildataModelsResponse;
      const models = Array.isArray(data.models) ? data.models : [];

      // 记录成功响应
      logger.apiResponse({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        correlationId,
        duration,
      });

      logger.info("成功获取模型列表", {
        correlationId,
        modelCount: models.length,
        total: data.total,
        duration,
      });

      return {
        reachable: true,
        models,
      };
    } finally {
      await release();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const duration = Date.now() - startTime;

    logger.error("获取模型列表时发生异常", error as Error, {
      correlationId,
      error: errorMessage,
      duration,
    });

    return {
      reachable: false,
      models: [],
      error: errorMessage,
    };
  }
}

/**
 * 将Gildata模型转换为OpenClaw模型定义
 */
export function convertGildataModelToModelDefinition(
  model: GildataModelResponse,
): ModelDefinitionConfig {
  const hasVision = model.capabilities?.includes("vision") ?? false;
  const input: ("text" | "image")[] = hasVision ? ["text", "image"] : ["text"];

  return {
    id: model.id,
    name: model.display_name || model.name,
    description: model.description,
    input,
    cost: {
      input: model.pricing?.input ?? 0.001,
      output: model.pricing?.output ?? 0.002,
      currency: model.pricing?.currency ?? "USD",
    },
    contextWindow: model.context_length ?? 4096,
    maxTokens: model.max_tokens ?? 4096,
  };
}

/**
 * 获取可用的模型定义列表
 */
export async function getGildataModelDefinitions(params: {
  baseUrl?: string;
  apiKey: string;
  headers?: Record<string, string>;
}): Promise<ModelDefinitionConfig[]> {
  const fetched = await fetchGildataModels(params);

  if (!fetched.reachable || fetched.models.length === 0) {
    return [];
  }

  return fetched.models.map(convertGildataModelToModelDefinition);
}

/**
 * 获取特定模型的定义
 */
export async function getGildataModelDefinition(
  modelId: string,
  params: {
    baseUrl?: string;
    apiKey: string;
    headers?: Record<string, string>;
  },
): Promise<ModelDefinitionConfig | undefined> {
  const definitions = await getGildataModelDefinitions(params);
  const resolvedId = resolveGildataModelId(modelId);
  return definitions.find((m) => m.id === resolvedId);
}
