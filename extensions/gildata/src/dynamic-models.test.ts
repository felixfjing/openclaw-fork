import { describe, it, expect } from "vitest";
import {
  resolveGildataModelId,
  getGildataModelDisplayName,
  getGildataModelAliases,
  GILDATA_MODEL_ALIASES,
  GILDATA_MODEL_TO_ALIAS,
} from "./dynamic-models.js";

describe("Dynamic Models", () => {
  describe("Model Aliases", () => {
    it("should have correct alias mappings", () => {
      expect(GILDATA_MODEL_ALIASES).toEqual({
        "qwen-plus": "qwen-plus",
        "qwen2-72b": "qwen2-72b-instruct-aliyun",
        "qwen-max": "qwen-max-latest",
        "qwen-plus-aliyun": "qwen-plus-latest-aliyun",
        "qwen-plus-latest": "qwen-plus-latest",
        "deepseek-r1": "deepseek-r1",
      });
    });

    it("should have correct reverse mappings", () => {
      expect(GILDATA_MODEL_TO_ALIAS).toEqual({
        "qwen-plus": "qwen-plus",
        "qwen2-72b-instruct-aliyun": "qwen2-72b",
        "qwen-max-latest": "qwen-max",
        "qwen-plus-latest-aliyun": "qwen-plus-aliyun",
        "qwen-plus-latest": "qwen-plus-latest",
        "deepseek-r1": "deepseek-r1",
      });
    });

    it("should return correct alias for known models", () => {
      expect(getGildataModelDisplayName("qwen-plus")).toBe("qwen-plus");
      expect(getGildataModelDisplayName("qwen2-72b-instruct-aliyun")).toBe("qwen2-72b");
      expect(getGildataModelDisplayName("qwen-max-latest")).toBe("qwen-max");
      expect(getGildataModelDisplayName("qwen-plus-latest-aliyun")).toBe("qwen-plus-aliyun");
      expect(getGildataModelDisplayName("qwen-plus-latest")).toBe("qwen-plus-latest");
      expect(getGildataModelDisplayName("deepseek-r1")).toBe("deepseek-r1");
    });

    it("should return model name for unknown models", () => {
      expect(getGildataModelDisplayName("unknown-model")).toBe("unknown-model");
      expect(getGildataModelDisplayName("gpt-4")).toBe("gpt-4");
    });
  });

  describe("resolveGildataModelId", () => {
    it("should resolve alias to actual model", () => {
      expect(resolveGildataModelId("qwen-plus")).toBe("qwen-plus");
      expect(resolveGildataModelId("qwen2-72b")).toBe("qwen2-72b-instruct-aliyun");
      expect(resolveGildataModelId("qwen-max")).toBe("qwen-max-latest");
      expect(resolveGildataModelId("qwen-plus-aliyun")).toBe("qwen-plus-latest-aliyun");
      expect(resolveGildataModelId("qwen-plus-latest")).toBe("qwen-plus-latest");
      expect(resolveGildataModelId("deepseek-r1")).toBe("deepseek-r1");
    });

    it("should return original model for non-aliases", () => {
      expect(resolveGildataModelId("gpt-4")).toBe("gpt-4");
      expect(resolveGildataModelId("unknown-model")).toBe("unknown-model");
      expect(resolveGildataModelId("claude-3")).toBe("claude-3");
    });

    it("should be case-sensitive", () => {
      expect(resolveGildataModelId("QWEN-PLUS")).toBe("QWEN-PLUS");
      expect(resolveGildataModelId("qwen-plus")).toBe("qwen-plus");
    });
  });

  describe("getGildataModelAliases", () => {
    it("should return all model aliases", () => {
      const aliases = getGildataModelAliases();
      expect(Object.keys(aliases).length).toBe(6);
      expect(aliases).toHaveProperty("qwen-plus");
      expect(aliases).toHaveProperty("qwen2-72b");
      expect(aliases).toHaveProperty("qwen-max");
      expect(aliases).toHaveProperty("qwen-plus-aliyun");
      expect(aliases).toHaveProperty("qwen-plus-latest");
      expect(aliases).toHaveProperty("deepseek-r1");
    });

    it("should return a copy of the aliases", () => {
      const aliases1 = getGildataModelAliases();
      const aliases2 = getGildataModelAliases();
      expect(aliases1).not.toBe(aliases2);
      expect(aliases1).toEqual(aliases2);
    });
  });
});
