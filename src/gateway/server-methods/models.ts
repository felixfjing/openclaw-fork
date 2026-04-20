import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet, resolveConfiguredModelRef } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const modelsHandlers: GatewayRequestHandlers = {
  "models.list": async ({ params, respond, context }) => {
    if (!validateModelsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.list params: ${formatValidationErrors(validateModelsListParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const catalog = await context.loadGatewayModelCatalog();
      const cfg = loadConfig();
      const { allowedCatalog } = buildAllowedModelSet({
        cfg,
        catalog,
        defaultProvider: DEFAULT_PROVIDER,
      });
      let models = allowedCatalog.length > 0 ? allowedCatalog : catalog;

      // 按默认模型所属 provider 过滤：只展示默认 provider 提供的模型
      const defaultRef = resolveConfiguredModelRef({
        cfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL,
      });
      if (defaultRef.provider !== DEFAULT_PROVIDER) {
        const providerId = defaultRef.provider.toLowerCase();
        models = models.filter((m) => m.provider.toLowerCase() === providerId);
      }

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
