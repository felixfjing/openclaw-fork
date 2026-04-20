import { describe, it, expect } from "vitest";
import {
  isSetupStatusPath,
  isSetupDownloadUvPath,
  isSetupDeploySkillsPath,
  isSetupConfigureProviderPath,
  isSetupPath,
} from "./setup-http-stages.js";

describe("setup-http-stages path matching", () => {
  it("matches /api/setup/status", () => {
    expect(isSetupStatusPath("/api/setup/status")).toBe(true);
    expect(isSetupStatusPath("/api/setup/status/")).toBe(false);
    expect(isSetupStatusPath("/api/setup/other")).toBe(false);
  });

  it("matches /api/setup/download-uv", () => {
    expect(isSetupDownloadUvPath("/api/setup/download-uv")).toBe(true);
    expect(isSetupDownloadUvPath("/api/setup/download-uv/")).toBe(false);
  });

  it("matches /api/setup/deploy-skills", () => {
    expect(isSetupDeploySkillsPath("/api/setup/deploy-skills")).toBe(true);
    expect(isSetupDeploySkillsPath("/api/setup/deploy-skills/")).toBe(false);
  });

  it("matches /api/setup/configure-provider", () => {
    expect(isSetupConfigureProviderPath("/api/setup/configure-provider")).toBe(true);
    expect(isSetupConfigureProviderPath("/api/setup/configure-provider/")).toBe(false);
  });

  it("isSetupPath matches any /api/setup/* path", () => {
    expect(isSetupPath("/api/setup/status")).toBe(true);
    expect(isSetupPath("/api/setup/download-uv")).toBe(true);
    expect(isSetupPath("/api/setup/unknown")).toBe(true);
    expect(isSetupPath("/api/other")).toBe(false);
    expect(isSetupPath("/api/setup")).toBe(false);
  });
});
