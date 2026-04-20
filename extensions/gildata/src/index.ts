import {
  definePluginEntry,
  type OpenClawPluginApi,
  type ProviderAuthContext,
  type ProviderAuthMethodNonInteractiveContext,
  type ProviderRuntimeModel,
} from "openclaw/plugin-sdk/plugin-entry";
import { CUSTOM_LOCAL_AUTH_MARKER } from "openclaw/plugin-sdk/provider-auth";
import { GILDATA_MODEL_ALIASES } from "./dynamic-models.js";

const PROVIDER_ID = "gildata";

// 缓存动态模型（按baseUrl）
const cachedDynamicModels = new Map<string, ProviderRuntimeModel[]>();

/**
 * 返回 gildata catalog 条目。
 * 优先使用配置中的 models.providers.gildata.models，
 * 回退到 GILDATA_MODEL_ALIASES 硬编码列表。
 */
function resolveGildataAugmentedCatalogEntries(config: OpenClawConfig | undefined) {
  const entries: Array<{ id: string; name: string; provider: string }> = [];
  const seen = new Set<string>();

  const addEntry = (id: string, name: string) => {
    const key = id.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ id, name, provider: PROVIDER_ID });
    }
  };

  // 优先读取配置中的模型列表
  const configuredModels = (config?.models?.providers?.gildata as any)?.models;
  if (Array.isArray(configuredModels)) {
    for (const model of configuredModels) {
      if (model?.id) {
        addEntry(model.id, model.name || model.id);
      }
    }
  }

  // 补充别名列表中未在配置中出现的模型
  for (const [alias] of Object.entries(GILDATA_MODEL_ALIASES)) {
    addEntry(alias, alias);
  }

  return entries;
}

/** Lazily loads setup helpers so provider wiring stays lightweight at startup. */
async function loadProviderSetup() {
  return await import("./api.js");
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "Gildata Provider",
  description: "Gildata AI service provider with complete warrenq authentication support",
  register(api: OpenClawPluginApi) {
    // 注册 Warrenq Web 登录 HTTP 路由
    // auth: "plugin" — 用户此时未认证，由插件自处理权限
    // handler 使用懒加载，首次请求时才 import 模块
    api.registerHttpRoute({
      path: "/plugins/gildata/login",
      handler: async (req, res) => {
        const { handleLoginRoute } = await import("./login-route.js");
        return handleLoginRoute(req, res);
      },
      auth: "plugin",
    });

    api.registerProvider({
      id: PROVIDER_ID,
      label: "Gildata",
      docsPath: "/providers/gildata",
      envVars: ["GILDATA_API_TOKEN", "warrenq_USERNAME", "warrenq_PASSWORD"],
      auth: [
        {
          id: "warrenq",
          label: "warrenq完整认证",
          hint: "warrenq system authentication with C# terminal login",
          kind: "custom",
          run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
            const providerSetup = await loadProviderSetup();
            return await providerSetup.promptAndConfigureGildataInteractive({
              config: ctx.config,
              prompter: ctx.prompter,
              secretInputMode: ctx.secretInputMode,
              allowSecretRefPrompt: ctx.allowSecretRefPrompt,
            });
          },
          runNonInteractive: async (ctx: ProviderAuthMethodNonInteractiveContext) => {
            const providerSetup = await loadProviderSetup();
            return await providerSetup.configureGildataNonInteractive(ctx);
          },
        },
      ],
      discovery: {
        order: "late",
        run: async (ctx) => {
          const providerSetup = await loadProviderSetup();
          return await providerSetup.discoverGildataProvider(ctx);
        },
      },
      resolveSyntheticAuth: ({ providerConfig }) => {
        const config = providerConfig as any;
        const warrenqEnabled = config?.autoLogin ?? false;

        if (warrenqEnabled && config?.tenantId && config?.access_token) {
          return {
            kind: "warrenq",
            tenantId: config.tenantId,
            userId: config.userId,
            access_token: config.access_token,
          };
        }

        if (config?.apiKey) {
          return {
            kind: "api-key",
            apiKey: config.apiKey,
          };
        }

        return undefined;
      },
      shouldDeferSyntheticProfileAuth: ({ resolvedApiKey }) =>
        // 如果启用了warrenq，延迟综合认证
        (resolvedApiKey as any)?.warrenqEnabled ?? false,
      normalizeConfig: ({ providerConfig }) => {
        // 规范化配置，确保必要的字段存在
        return providerConfig;
      },
      prepareRuntimeAuth: async (ctx) => {
        const providerSetup = await loadProviderSetup();
        const result = await providerSetup.prepareGildataRuntimeAuth?.(ctx);
        return {
          apiKey: result?.apiKey ?? ctx.apiKey,
          request: result?.request ? { headers: result.request.headers } : undefined,
        };
      },
      prepareDynamicModel: async (ctx) => {
        const providerSetup = await loadProviderSetup();
        const baseUrl = (ctx.providerConfig as any)?.chatBaseUrl ?? (ctx.providerConfig as any)?.warrenqBaseUrl;

        const models = await providerSetup.prepareGildataDynamicModels(ctx);
        cachedDynamicModels.set(baseUrl ?? "", models);
      },
      resolveDynamicModel: (ctx) =>
        cachedDynamicModels
          .get((ctx.providerConfig as any)?.chatBaseUrl ?? "")
          ?.find((model) => model.id === ctx.modelId),
      augmentModelCatalog: (ctx) => resolveGildataAugmentedCatalogEntries(ctx.config),
      wizard: {
        setup: {
          choiceId: PROVIDER_ID,
          choiceLabel: "warrenq完整认证",
          choiceHint: "warrenq C#终端登录认证",
          groupId: PROVIDER_ID,
          groupLabel: "Gildata",
          groupHint: "Gildata AI service provider",
          methodId: "warrenq",
        },
        modelPicker: {
          label: "Gildata (warrenq)",
          hint: "Select from available Gildata models",
          methodId: "warrenq",
        },
      },
    });
  },
});
