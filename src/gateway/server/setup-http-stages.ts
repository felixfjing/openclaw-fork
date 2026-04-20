/**
 * Setup HTTP Stages 模块
 *
 * 为 Gateway 提供 Setup 向导相关的 HTTP 端点处理。
 * 端点列表：
 * - GET  /api/setup/status            → 返回当前安装状态
 * - POST /api/setup/download-uv       → 下载 uv 并通过 SSE 推送进度
 * - POST /api/setup/deploy-skills     → 部署技能并通过 SSE 推送进度
 * - POST /api/setup/configure-provider → 写入 provider 配置
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { detectSetupState, getOpenClawHome, type SetupState } from "./setup-state.js";

// ─── 路径匹配 ──────────────────────────────────────────────

export function isSetupStatusPath(p: string): boolean {
  return p === "/api/setup/status";
}
export function isSetupDownloadUvPath(p: string): boolean {
  return p === "/api/setup/download-uv";
}
export function isSetupDeploySkillsPath(p: string): boolean {
  return p === "/api/setup/deploy-skills";
}
export function isSetupConfigureProviderPath(p: string): boolean {
  return p === "/api/setup/configure-provider";
}
export function isSetupPath(p: string): boolean {
  return p.startsWith("/api/setup/");
}

// ─── 内部工具 ──────────────────────────────────────────────

/**
 * 脚本目录路径。
 * 从 import.meta.url 往上回溯到项目根目录下的 scripts/。
 * 编译后位于 dist/gateway/server/，需要往上 3 级才能到达 dist/，
 * scripts 通常在项目根目录，因此根据实际部署调整。
 */
/**
 * 定位 scripts 目录。
 * tsdown 编译后 import.meta.url 路径不可预测，
 * 改用 process.argv[1] 和 import.meta.url 双重回溯。
 */
const scriptsDir = (() => {
  const marker = "download-uv.mjs";
  // 优先从 entry point 回溯
  const candidates: string[] = [];
  if (process.argv[1]) candidates.push(process.argv[1]);
  candidates.push(fileURLToPath(import.meta.url));

  for (const start of candidates) {
    let dir = dirname(start);
    for (let i = 0; i < 10; i++) {
      if (existsSync(join(dir, "scripts", marker))) {
        return join(dir, "scripts");
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  // 最终回退：假设 CWD 为项目根
  return join(process.cwd(), "scripts");
})();

/** 发送 JSON 响应 */
function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/** 建立 SSE 连接，返回一个用于推送事件的回调 */
function startSse(
  res: ServerResponse,
): (event: string, data: unknown) => void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  return (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

/** 读取请求体为字符串 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ─── 各端点 Handler ────────────────────────────────────────

/** GET /api/setup/status */
async function handleSetupStatusRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const state = detectSetupState();
  sendJson(res, 200, state);
  return true;
}

/** POST /api/setup/download-uv */
async function handleSetupDownloadUvRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const scriptPath = join(scriptsDir, "download-uv.mjs");

  if (!existsSync(scriptPath)) {
    sendJson(res, 500, { error: `脚本不存在: ${scriptPath}` });
    return true;
  }

  const send = startSse(res);

  try {
    send("progress", { stage: "download-uv", status: "running" });
    // 使用 execFileSync 执行脚本，捕获 stdout 作为进度信息
    const output = execFileSync("node", [scriptPath], {
      encoding: "utf8",
      timeout: 300_000, // 5 分钟超时
    });
    send("progress", { stage: "download-uv", status: "completed", output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { stage: "download-uv", error: message });
  }
  res.end();
  return true;
}

/** POST /api/setup/deploy-skills */
async function handleSetupDeploySkillsRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const scriptPath = join(scriptsDir, "prepare-preinstalled-skills.mjs");

  if (!existsSync(scriptPath)) {
    sendJson(res, 500, { error: `脚本不存在: ${scriptPath}` });
    return true;
  }

  const send = startSse(res);

  try {
    send("progress", { stage: "deploy-skills", status: "running" });
    const output = execFileSync("node", [scriptPath], {
      encoding: "utf8",
      timeout: 300_000,
    });
    send("progress", { stage: "deploy-skills", status: "completed", output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { stage: "deploy-skills", error: message });
  }
  res.end();
  return true;
}

/** POST /api/setup/configure-provider */
async function handleSetupConfigureProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  // 读取请求体
  const raw = await readBody(req);
  let body: { provider?: string; apiKey?: string; model?: string };

  try {
    body = JSON.parse(raw);
  } catch {
    sendJson(res, 400, { error: "无效的 JSON 请求体" });
    return true;
  }

  const { provider, apiKey, model } = body;
  if (!provider || !apiKey) {
    sendJson(res, 400, { error: "缺少必填字段: provider, apiKey" });
    return true;
  }

  // 写入 ~/.openclaw/openclaw.json
  const homeDir = getOpenClawHome();
  mkdirSync(homeDir, { recursive: true });
  const configPath = join(homeDir, "openclaw.json");

  // 读取已有配置（如果存在），使用不可变模式合并
  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const rawConfig = await import("node:fs").then((fs) =>
        fs.readFileSync(configPath, "utf8"),
      );
      existing = JSON.parse(rawConfig);
    } catch {
      // 解析失败则使用空对象
    }
  }

  // 写入 models.providers 下（遵循 openclaw 配置 schema）
  const existingModels = (existing.models as Record<string, unknown>) ?? {};
  const existingProviders = (existingModels.providers as Record<string, unknown>) ?? {};
  const providers = {
    ...existingProviders,
    [provider]: {
      ...((existingProviders[provider] as Record<string, unknown>) ?? {}),
      apiKey,
      ...(model ? { model } : {}),
    },
  };

  // 当配置 gildata 时，同时设置默认模型
  const defaultModel =
    provider === "gildata"
      ? { primary: `gildata/${model || "deepseek-r1"}` }
      : undefined;

  const existingAgents = (existing.agents as Record<string, unknown>) ?? {};
  const existingDefaults = (existingAgents.defaults as Record<string, unknown>) ?? {};

  const merged = {
    ...existing,
    models: { ...existingModels, providers },
    ...(defaultModel
      ? { agents: { ...existingAgents, defaults: { ...existingDefaults, model: defaultModel } } }
      : {}),
  };
  writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");

  sendJson(res, 200, { ok: true, provider });
  return true;
}

// ─── 总入口 ────────────────────────────────────────────────

/**
 * 统一处理 /api/setup/* 路径的请求。
 * 返回 true 表示已处理，false 表示不匹配。
 */
export async function handleSetupRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (isSetupStatusPath(path)) return handleSetupStatusRequest(req, res);
  if (isSetupDownloadUvPath(path)) return handleSetupDownloadUvRequest(req, res);
  if (isSetupDeploySkillsPath(path)) return handleSetupDeploySkillsRequest(req, res);
  if (isSetupConfigureProviderPath(path)) return handleSetupConfigureProviderRequest(req, res);

  return false;
}
