import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  readSetupState,
  writeSetupState,
  detectSetupState,
  type SetupState,
} from "./setup-state.js";

describe("setup-state", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "openclaw-setup-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns default state when no file exists", () => {
    const state = readSetupState(tempDir);
    expect(state).toEqual({
      uvInstalled: false,
      skillsDeployed: false,
      providerConfigured: false,
      completed: false,
      updatedAt: null,
    });
  });

  it("writes and reads state", () => {
    const state: SetupState = {
      uvInstalled: true,
      skillsDeployed: false,
      providerConfigured: false,
      completed: false,
      updatedAt: new Date().toISOString(),
    };
    writeSetupState(tempDir, state);
    const read = readSetupState(tempDir);
    expect(read.uvInstalled).toBe(true);
    expect(read.skillsDeployed).toBe(false);
  });

  it("detectSetupState checks uv binary existence", () => {
    const state = detectSetupState(tempDir);
    expect(state.uvInstalled).toBe(false);
  });

  it("detectSetupState detects skills lock file", () => {
    const skillsDir = join(tempDir, "skills");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, ".preinstalled-lock.json"), "{}", "utf8");
    const state = detectSetupState(tempDir);
    expect(state.skillsDeployed).toBe(true);
  });

  it("detectSetupState detects provider config", () => {
    writeFileSync(
      join(tempDir, "openclaw.json"),
      JSON.stringify({ providers: { anthropic: { apiKey: "test" } } }),
      "utf8",
    );
    const state = detectSetupState(tempDir);
    expect(state.providerConfigured).toBe(true);
  });

  it("detectSetupState sets completed when all checks pass", () => {
    // 创建 uv 二进制
    const platformId = `${process.platform}-${process.arch}`;
    const binDir = join(tempDir, "bin", platformId);
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, process.platform === "win32" ? "uv.exe" : "uv"), "", "utf8");

    // 创建技能 lock 文件
    mkdirSync(join(tempDir, "skills"), { recursive: true });
    writeFileSync(join(tempDir, "skills", ".preinstalled-lock.json"), "{}", "utf8");

    // 创建 provider 配置
    writeFileSync(
      join(tempDir, "openclaw.json"),
      JSON.stringify({ providers: { anthropic: { apiKey: "test" } } }),
      "utf8",
    );

    const state = detectSetupState(tempDir);
    expect(state.completed).toBe(true);
  });
});
