# OpenClaw Web 安装向导 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 openclaw 添加 Web 安装向导，使用户首次访问 UI 时能通过浏览器完成 uv 下载、技能部署、AI Provider 配置等初始化步骤。

**Architecture:** 在 Gateway 现有的 stage pipeline 中添加 setup HTTP 端点；UI 端新增 `/setup` tab，使用 Lit 函数式组件构建多步向导；利用已有的 `setup-state.json` 和 workspace state 做首次运行检测。

**Tech Stack:** TypeScript (ESM), Node.js 原生 HTTP (非 Express), Lit (Web Components), SSE (Server-Sent Events), Vitest

**前置知识:**
- Gateway 使用原生 `createHttpServer`，路由通过 `GatewayHttpRequestStage[]` pipeline 处理（见 `src/gateway/server-http.ts:902-1096`）
- UI 视图是返回 `html` 模板的函数，接收 props 对象（见 `ui/src/ui/views/overview.ts`）
- 已有 wizard RPC 方法（`src/gateway/server-methods/wizard.ts`），但设计为 CLI 交互，Web 端需要独立的 HTTP API
- 配置文件为 JSON5 格式，位于 `~/.openclaw/openclaw.json`
- 首次运行检测通过 `<workspace>/.openclaw/state/workspace.json` 的 `setupCompletedAt` 字段

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/gateway/server/setup-state.ts` | Setup 状态读写（`~/.openclaw/setup-state.json`） |
| `src/gateway/server/setup-http-stages.ts` | Setup HTTP 端点（status / download-uv / deploy-skills / configure-provider） |
| `src/gateway/server/setup-http-stages.test.ts` | Setup HTTP 端点测试 |
| `ui/src/ui/views/setup/setup-wizard.ts` | 向导主组件（步骤控制、状态管理） |
| `ui/src/ui/views/setup/setup-step-check.ts` | Step 1: 环境检测 |
| `ui/src/ui/views/setup/setup-step-uv.ts` | Step 2: 安装 uv |
| `ui/src/ui/views/setup/setup-step-skills.ts` | Step 3: 部署技能 |
| `ui/src/ui/views/setup/setup-step-provider.ts` | Step 4: 配置 AI Provider |
| `ui/src/ui/views/setup/setup-step-complete.ts` | Step 5: 完成 |
| `ui/src/ui/views/setup/setup-types.ts` | 共享类型定义 |
| `ui/src/ui/views/setup/setup-styles.css` | 样式 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/gateway/server-http.ts` | 注册 setup HTTP stages |
| `ui/src/ui/navigation.ts` | 新增 `"setup"` Tab 类型和路径 |
| `ui/src/ui/app-render.ts` | 新增 setup tab 渲染分支 |
| `ui/src/ui/app-settings.ts` | 新增 setup 导航逻辑 |
| `ui/src/ui/app-gateway.ts` | 首次运行检测，自动跳转 setup |

---

## Phase 1: Gateway Setup API（后端）

### Task 1: Setup 状态管理模块

**Files:**
- Create: `src/gateway/server/setup-state.ts`
- Test: `src/gateway/server/setup-state.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/gateway/server/setup-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
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
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/gateway/server/setup-state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现状态管理模块**

```typescript
// src/gateway/server/setup-state.ts
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, platform, arch } from "node:os";

export interface SetupState {
  uvInstalled: boolean;
  skillsDeployed: boolean;
  providerConfigured: boolean;
  completed: boolean;
  updatedAt: string | null;
}

const SETUP_STATE_FILENAME = "setup-state.json";

const DEFAULT_STATE: SetupState = {
  uvInstalled: false,
  skillsDeployed: false,
  providerConfigured: false,
  completed: false,
  updatedAt: null,
};

export function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? join(homedir(), ".openclaw");
}

export function readSetupState(homeDir?: string): SetupState {
  const dir = homeDir ?? getOpenClawHome();
  const filePath = join(dir, SETUP_STATE_FILENAME);
  if (!existsSync(filePath)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = readFileSync(filePath, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function writeSetupState(homeDir: string, state: SetupState): void {
  const dir = homeDir ?? getOpenClawHome();
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, SETUP_STATE_FILENAME);
  writeFileSync(
    filePath,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

export function detectSetupState(homeDir?: string): SetupState {
  const dir = homeDir ?? getOpenClawHome();
  const current = readSetupState(dir);

  // 检测 uv 二进制
  const platformId = `${platform()}-${arch()}`;
  const binNames = platform() === "win32" ? "uv.exe" : "uv";
  const uvBinPath = join(dir, "bin", platformId, binNames);
  current.uvInstalled = existsSync(uvBinPath);

  // 检测技能部署（检查 lock 文件）
  const lockPath = join(dir, "skills", ".preinstalled-lock.json");
  current.skillsDeployed = existsSync(lockPath);

  // 检测 provider 配置（检查主配置文件是否存在且包含 providers）
  const configPath = join(dir, "openclaw.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      const providers = config?.providers;
      current.providerConfigured =
        typeof providers === "object" && providers !== null && Object.keys(providers).length > 0;
    } catch {
      current.providerConfigured = false;
    }
  }

  // 综合判断
  current.completed =
    current.uvInstalled &&
    current.skillsDeployed &&
    current.providerConfigured;

  return current;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/gateway/server/setup-state.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/gateway/server/setup-state.ts src/gateway/server/setup-state.test.ts
git commit -m "feat(gateway): add setup state management module"
```

---

### Task 2: Setup HTTP Stages — Status 端点

**Files:**
- Create: `src/gateway/server/setup-http-stages.ts`
- Create: `src/gateway/server/setup-http-stages.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
// src/gateway/server/setup-http-stages.test.ts
import { describe, it, expect } from "vitest";
import {
  isSetupStatusPath,
  isSetupDownloadUvPath,
  isSetupDeploySkillsPath,
  isSetupConfigureProviderPath,
} from "./setup-http-stages.js";

describe("setup-http-stages path matching", () => {
  it("matches /api/setup/status", () => {
    expect(isSetupStatusPath("/api/setup/status")).toBe(true);
    expect(isSetupStatusPath("/api/setup/status/")).toBe(false);
    expect(isSetupStatusPath("/api/setup/other")).toBe(false);
  });

  it("matches POST /api/setup/download-uv", () => {
    expect(isSetupDownloadUvPath("/api/setup/download-uv")).toBe(true);
    expect(isSetupDownloadUvPath("/api/setup/download-uv/")).toBe(false);
  });

  it("matches POST /api/setup/deploy-skills", () => {
    expect(isSetupDeploySkillsPath("/api/setup/deploy-skills")).toBe(true);
  });

  it("matches POST /api/setup/configure-provider", () => {
    expect(isSetupConfigureProviderPath("/api/setup/configure-provider")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/gateway/server/setup-http-stages.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 path matching 和 status handler**

```typescript
// src/gateway/server/setup-http-stages.ts
import type { IncomingMessage, ServerResponse } from "node:http";
import { detectSetupState, readSetupState } from "./setup-state.js";

// --- Path matching ---
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

// --- Helpers ---
function jsonResponse(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function startSse(res: ServerResponse): (event: string, data: unknown) => void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  return (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

// --- Handlers ---
export async function handleSetupStatusRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const state = detectSetupState();
  jsonResponse(res, { ok: true, state });
  return true;
}

export async function handleSetupDownloadUvRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (req.method !== "POST") {
    jsonResponse(res, { ok: false, error: "Method not allowed" }, 405);
    return true;
  }

  const send = startSse(res);
  try {
    send("progress", { step: "detecting", message: "检测当前平台..." });

    const { execFileSync } = await import("node:child_process");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const scriptPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/download-uv.mjs",
    );

    send("progress", { step: "downloading", message: "正在下载 uv..." });

    execFileSync(process.execPath, [scriptPath], {
      timeout: 120_000,
      stdio: "pipe",
      encoding: "utf8",
    });

    const state = detectSetupState();
    send("done", { ok: true, uvInstalled: state.uvInstalled });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { ok: false, error: message });
  }
  res.end();
  return true;
}

export async function handleSetupDeploySkillsRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (req.method !== "POST") {
    jsonResponse(res, { ok: false, error: "Method not allowed" }, 405);
    return true;
  }

  const send = startSse(res);
  try {
    const { execFileSync } = await import("node:child_process");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const scriptPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../scripts/prepare-preinstalled-skills.mjs",
    );

    send("progress", { step: "fetching", message: "正在拉取预装技能..." });

    execFileSync(process.execPath, [scriptPath], {
      timeout: 180_000,
      stdio: "pipe",
      encoding: "utf8",
    });

    const state = detectSetupState();
    send("done", { ok: true, skillsDeployed: state.skillsDeployed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send("error", { ok: false, error: message });
  }
  res.end();
  return true;
}

export async function handleSetupConfigureProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  if (req.method !== "POST") {
    jsonResponse(res, { ok: false, error: "Method not allowed" }, 405);
    return true;
  }

  try {
    const body = await readBody(req);
    const parsed = JSON.parse(body);
    const { provider, apiKey, model } = parsed;

    if (!provider || !apiKey) {
      jsonResponse(res, { ok: false, error: "provider and apiKey are required" }, 400);
      return true;
    }

    // 写入 ~/.openclaw/openclaw.json
    const { readSetupState, writeSetupState, getOpenClawHome } = await import(
      "./setup-state.js"
    );
    const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const home = getOpenClawHome();
    const configPath = join(home, "openclaw.json");
    mkdirSync(home, { recursive: true });

    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, "utf8"));
      } catch {
        config = {};
      }
    }

    const providers = {
      ...((config.providers as Record<string, unknown>) ?? {}),
      [provider]: { apiKey, ...(model ? { model } : {}) },
    };
    config.providers = providers;

    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");

    const state = detectSetupState();
    jsonResponse(res, { ok: true, providerConfigured: state.providerConfigured });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jsonResponse(res, { ok: false, error: message }, 500);
  }
  return true;
}

// --- Stage entry point ---
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/gateway/server/setup-http-stages.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/gateway/server/setup-http-stages.ts src/gateway/server/setup-http-stages.test.ts
git commit -m "feat(gateway): add setup HTTP stages for installation wizard"
```

---

### Task 3: 注册 Setup Stages 到 Gateway Pipeline

**Files:**
- Modify: `src/gateway/server-http.ts`

- [ ] **Step 1: 找到 stage 注册位置**

在 `src/gateway/server-http.ts` 中找到 `requestStages` 数组的构建位置（约 902-1096 行），以及 stage 的类型定义 `GatewayHttpRequestStage`。

- [ ] **Step 2: 添加 import**

在 `server-http.ts` 顶部的 import 区域添加：

```typescript
import { isSetupPath, handleSetupRequest } from "./server/setup-http-stages.js";
```

- [ ] **Step 3: 在 pipeline 中添加 setup stage**

在 `requestStages` 数组中，找到 `control-ui-http` stage **之前**，添加 setup stage：

```typescript
// Setup wizard API (must be before control-ui for path matching)
if (isSetupPath(requestPath)) {
  requestStages.push({
    name: "setup-api",
    run: () => handleSetupRequest(req, res),
  });
}
```

- [ ] **Step 4: 验证 Gateway 启动**

Run: `pnpm build && pnpm openclaw gateway run --bind loopback --port 18789 --force`
Expected: Gateway 正常启动，访问 `http://127.0.0.1:18789/api/setup/status` 返回 JSON

```bash
curl http://127.0.0.1:18789/api/setup/status
# Expected: {"ok":true,"state":{"uvInstalled":true,"skillsDeployed":true,"providerConfigured":false,"completed":false,"updatedAt":null}}
```

- [ ] **Step 5: 提交**

```bash
git add src/gateway/server-http.ts
git commit -m "feat(gateway): register setup HTTP stages in request pipeline"
```

---

## Phase 2: Setup Wizard UI（前端）

### Task 4: UI 类型定义和导航注册

**Files:**
- Create: `ui/src/ui/views/setup/setup-types.ts`
- Modify: `ui/src/ui/navigation.ts`

- [ ] **Step 1: 创建共享类型**

```typescript
// ui/src/ui/views/setup/setup-types.ts
export type SetupStep = "check" | "uv" | "skills" | "provider" | "complete";

export interface SetupWizardState {
  currentStep: SetupStep;
  uvInstalled: boolean;
  skillsDeployed: boolean;
  providerConfigured: boolean;
  completed: boolean;
  uvProgress: string | null;
  skillsProgress: string | null;
  providerError: string | null;
  gatewayUrl: string;
}

export const SETUP_STEPS: SetupStep[] = ["check", "uv", "skills", "provider", "complete"];

export function nextStep(current: SetupStep, state: SetupWizardState): SetupStep {
  const idx = SETUP_STEPS.indexOf(current);
  if (idx >= SETUP_STEPS.length - 1) return "complete";

  // 跳过已完成的步骤
  if (current === "check" && state.uvInstalled) return nextStep("uv", state);
  if (current === "uv" && state.uvInstalled) return nextStep("skills", state);
  if (current === "skills" && state.skillsDeployed) return nextStep("provider", state);
  if (current === "provider" && state.providerConfigured) return "complete";

  return SETUP_STEPS[idx + 1];
}
```

- [ ] **Step 2: 修改 navigation.ts 添加 setup tab**

```typescript
// ui/src/ui/navigation.ts — 修改 Tab 类型（约第 29 行）
export type Tab =
  | "agents"
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "communications"
  | "appearance"
  | "automation"
  | "infrastructure"
  | "aiAgents"
  | "debug"
  | "logs"
  | "dreams"
  | "setup";  // 新增
```

```typescript
// TAB_PATHS 新增（约第 50 行）
const TAB_PATHS: Record<Tab, string> = {
  // ... 保留已有
  setup: "/setup",
};
```

- [ ] **Step 3: 验证编译通过**

Run: `cd ui && pnpm build`
Expected: 编译通过（setup tab 可能还没有渲染逻辑，但类型应该正确）

- [ ] **Step 4: 提交**

```bash
git add ui/src/ui/views/setup/setup-types.ts ui/src/ui/navigation.ts
git commit -m "feat(ui): add setup tab type and navigation registration"
```

---

### Task 5: Setup Wizard 主组件

**Files:**
- Create: `ui/src/ui/views/setup/setup-wizard.ts`
- Create: `ui/src/ui/views/setup/setup-styles.css`

- [ ] **Step 1: 创建向导主组件**

```typescript
// ui/src/ui/views/setup/setup-wizard.ts
import { html, nothing } from "lit";
import { t } from "../../../i18n/index.ts";
import type { Tab } from "../navigation.ts";
import {
  type SetupWizardState,
  type SetupStep,
  SETUP_STEPS,
  nextStep,
} from "./setup-types.js";

export interface SetupWizardProps {
  state: SetupWizardState;
  gatewayUrl: string;
  onNavigate: (tab: Tab) => void;
  onStateChange: (patch: Partial<SetupWizardState>) => void;
}

const STEP_LABELS: Record<SetupStep, string> = {
  check: "环境检测",
  uv: "安装 uv",
  skills: "部署技能",
  provider: "配置 AI",
  complete: "完成",
};

export function renderSetupWizard(props: SetupWizardProps) {
  const { state } = props;
  const currentIdx = SETUP_STEPS.indexOf(state.currentStep);

  return html`
    <div class="setup-wizard">
      <div class="setup-wizard__header">
        <h1 class="setup-wizard__title">OpenClaw 安装向导</h1>
        <p class="setup-wizard__subtitle">首次使用？让我们帮你完成初始配置</p>
      </div>

      <div class="setup-wizard__steps">
        ${SETUP_STEPS.map(
          (step, idx) => html`
            <div
              class="setup-wizard__step ${idx === currentIdx
                ? "active"
                : idx < currentIdx
                  ? "done"
                  : ""}"
            >
              <span class="setup-wizard__step-num">${idx + 1}</span>
              <span class="setup-wizard__step-label">${STEP_LABELS[step]}</span>
            </div>
            ${idx < SETUP_STEPS.length - 1
              ? html`<div class="setup-wizard__connector"></div>`
              : nothing}
          `,
        )}
      </div>

      <div class="setup-wizard__content">
        ${state.currentStep === "check"
          ? renderCheckStep(props)
          : state.currentStep === "uv"
            ? renderUvStep(props)
            : state.currentStep === "skills"
              ? renderSkillsStep(props)
              : state.currentStep === "provider"
                ? renderProviderStep(props)
                : renderCompleteStep(props)}
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: 创建基础样式**

```css
/* ui/src/ui/views/setup/setup-styles.css */
.setup-wizard {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem;
}

.setup-wizard__header {
  text-align: center;
  margin-bottom: 2rem;
}

.setup-wizard__title {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.setup-wizard__subtitle {
  color: var(--color-text-secondary, #888);
  margin: 0;
}

.setup-wizard__steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 2rem;
}

.setup-wizard__step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  opacity: 0.5;
}

.setup-wizard__step.active {
  opacity: 1;
  background: var(--color-bg-secondary, #f0f0f0);
  font-weight: 600;
}

.setup-wizard__step.done {
  opacity: 0.8;
}

.setup-wizard__connector {
  width: 2rem;
  height: 2px;
  background: var(--color-border, #ddd);
}

.setup-wizard__content {
  background: var(--color-bg-secondary, #f8f8f8);
  border-radius: 0.75rem;
  padding: 2rem;
}

.setup-wizard__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
```

- [ ] **Step 3: 提交**

```bash
git add ui/src/ui/views/setup/setup-wizard.ts ui/src/ui/views/setup/setup-styles.css
git commit -m "feat(ui): add setup wizard main component and styles"
```

---

### Task 6: Step 组件 — 环境检测和 uv 安装

**Files:**
- Create: `ui/src/ui/views/setup/setup-step-check.ts`
- Create: `ui/src/ui/views/setup/setup-step-uv.ts`

- [ ] **Step 1: 环境检测步骤**

```typescript
// ui/src/ui/views/setup/setup-step-check.ts
import { html } from "lit";
import type { SetupWizardProps } from "./setup-wizard.js";
import { nextStep } from "./setup-types.js";

export async function fetchSetupStatus(gatewayUrl: string) {
  const base = gatewayUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/setup/status`);
  if (!res.ok) throw new Error(`状态检查失败: ${res.status}`);
  return res.json() as Promise<{
    ok: boolean;
    state: {
      uvInstalled: boolean;
      skillsDeployed: boolean;
      providerConfigured: boolean;
      completed: boolean;
    };
  }>;
}

export function renderCheckStep(props: SetupWizardProps) {
  const { state } = props;

  const onCheck = async () => {
    try {
      const result = await fetchSetupStatus(state.gatewayUrl);
      props.onStateChange({
        uvInstalled: result.state.uvInstalled,
        skillsDeployed: result.state.skillsDeployed,
        providerConfigured: result.state.providerConfigured,
        completed: result.state.completed,
        currentStep: nextStep("check", {
          ...state,
          uvInstalled: result.state.uvInstalled,
          skillsDeployed: result.state.skillsDeployed,
          providerConfigured: result.state.providerConfigured,
          completed: result.state.completed,
        }),
      });
    } catch (err) {
      console.error("[setup] 状态检查失败:", err);
    }
  };

  return html`
    <div class="setup-step">
      <h2>Step 1: 环境检测</h2>
      <p>检测当前系统环境和已有配置</p>

      <div class="setup-check-list">
        <div class="setup-check-item ${state.uvInstalled ? "ok" : "pending"}">
          <span class="setup-check-icon">${state.uvInstalled ? "✓" : "○"}</span>
          <span>uv 包管理器</span>
        </div>
        <div class="setup-check-item ${state.skillsDeployed ? "ok" : "pending"}">
          <span class="setup-check-icon">${state.skillsDeployed ? "✓" : "○"}</span>
          <span>预装技能</span>
        </div>
        <div class="setup-check-item ${state.providerConfigured ? "ok" : "pending"}">
          <span class="setup-check-icon">${state.providerConfigured ? "✓" : "○"}</span>
          <span>AI Provider 配置</span>
        </div>
      </div>

      <div class="setup-wizard__actions">
        <button class="btn btn--primary" @click=${onCheck}>
          开始检测
        </button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: uv 安装步骤**

```typescript
// ui/src/ui/views/setup/setup-step-uv.ts
import { html } from "lit";
import type { SetupWizardProps } from "./setup-wizard.js";
import { nextStep } from "./setup-types.js";

export function renderUvStep(props: SetupWizardProps) {
  const { state } = props;

  const onInstall = async () => {
    props.onStateChange({ uvProgress: "downloading" });

    try {
      const base = state.gatewayUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/setup/download-uv`, { method: "POST" });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const eventMatch = line.match(/^event: (\w+)\ndata: (.+)$/s);
          if (!eventMatch) continue;

          const [, eventType, data] = eventMatch;
          const parsed = JSON.parse(data);

          if (eventType === "progress") {
            props.onStateChange({ uvProgress: parsed.message });
          } else if (eventType === "done") {
            props.onStateChange({
              uvInstalled: true,
              uvProgress: null,
              currentStep: nextStep("uv", { ...state, uvInstalled: true }),
            });
          } else if (eventType === "error") {
            props.onStateChange({ uvProgress: `失败: ${parsed.error}` });
          }
        }
      }
    } catch (err) {
      props.onStateChange({
        uvProgress: `错误: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return html`
    <div class="setup-step">
      <h2>Step 2: 安装 uv</h2>
      <p>uv 是 Python 包管理器，用于运行文档处理等技能脚本</p>

      ${state.uvInstalled
        ? html`
            <div class="setup-status setup-status--ok">
              <span>✓</span> uv 已安装
            </div>
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                @click=${() =>
                  props.onStateChange({
                    currentStep: nextStep("uv", state),
                  })}
              >
                下一步
              </button>
            </div>
          `
        : html`
            ${state.uvProgress
              ? html`
                  <div class="setup-progress">
                    <div class="setup-progress__bar"></div>
                    <span>${state.uvProgress}</span>
                  </div>
                `
              : nothing}
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                ?disabled=${state.uvProgress !== null}
                @click=${onInstall}
              >
                ${state.uvProgress ? "安装中..." : "安装 uv"}
              </button>
            </div>
          `}
    </div>
  `;
}
```

- [ ] **Step 3: 提交**

```bash
git add ui/src/ui/views/setup/setup-step-check.ts ui/src/ui/views/setup/setup-step-uv.ts
git commit -m "feat(ui): add setup check and uv install step components"
```

---

### Task 7: Step 组件 — 技能部署、Provider 配置、完成

**Files:**
- Create: `ui/src/ui/views/setup/setup-step-skills.ts`
- Create: `ui/src/ui/views/setup/setup-step-provider.ts`
- Create: `ui/src/ui/views/setup/setup-step-complete.ts`

- [ ] **Step 1: 技能部署步骤**

```typescript
// ui/src/ui/views/setup/setup-step-skills.ts
import { html, nothing } from "lit";
import type { SetupWizardProps } from "./setup-wizard.js";
import { nextStep } from "./setup-types.js";

export function renderSkillsStep(props: SetupWizardProps) {
  const { state } = props;

  const onDeploy = async () => {
    props.onStateChange({ skillsProgress: "fetching" });

    try {
      const base = state.gatewayUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/setup/deploy-skills`, { method: "POST" });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const eventMatch = line.match(/^event: (\w+)\ndata: (.+)$/s);
          if (!eventMatch) continue;

          const [, eventType, data] = eventMatch;
          const parsed = JSON.parse(data);

          if (eventType === "progress") {
            props.onStateChange({ skillsProgress: parsed.message });
          } else if (eventType === "done") {
            props.onStateChange({
              skillsDeployed: true,
              skillsProgress: null,
              currentStep: nextStep("skills", { ...state, skillsDeployed: true }),
            });
          } else if (eventType === "error") {
            props.onStateChange({ skillsProgress: `失败: ${parsed.error}` });
          }
        }
      }
    } catch (err) {
      props.onStateChange({
        skillsProgress: `错误: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const skillsList = [
    "pdf", "xlsx", "docx", "pptx",
    "find-skills", "self-improving-agent",
    "tavily-search", "brave-web-search",
  ];

  return html`
    <div class="setup-step">
      <h2>Step 3: 部署预装技能</h2>
      <p>从 GitHub 拉取以下预装技能到本地</p>

      <div class="setup-skills-list">
        ${skillsList.map(
          (s) => html`<div class="setup-skills-item">${s}</div>`,
        )}
      </div>

      ${state.skillsDeployed
        ? html`
            <div class="setup-status setup-status--ok">
              <span>✓</span> 技能已部署 (${skillsList.length} 个)
            </div>
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                @click=${() =>
                  props.onStateChange({
                    currentStep: nextStep("skills", state),
                  })}
              >
                下一步
              </button>
            </div>
          `
        : html`
            ${state.skillsProgress
              ? html`
                  <div class="setup-progress">
                    <span>${state.skillsProgress}</span>
                  </div>
                `
              : nothing}
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                ?disabled=${state.skillsProgress !== null}
                @click=${onDeploy}
              >
                ${state.skillsProgress ? "部署中..." : "一键部署"}
              </button>
            </div>
          `}
    </div>
  `;
}
```

- [ ] **Step 2: Provider 配置步骤**

```typescript
// ui/src/ui/views/setup/setup-step-provider.ts
import { html, nothing } from "lit";
import type { SetupWizardProps } from "./setup-wizard.js";
import { nextStep } from "./setup-types.js";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-6" },
  { id: "openai", label: "OpenAI (GPT)", defaultModel: "gpt-4o" },
  { id: "azure-openai", label: "Azure OpenAI", defaultModel: "" },
  { id: "custom", label: "自定义", defaultModel: "" },
];

export function renderProviderStep(props: SetupWizardProps) {
  const { state } = props;
  let selectedProvider = "anthropic";
  let apiKey = "";
  let model = "";

  const onSave = async () => {
    props.onStateChange({ providerError: null });

    try {
      const base = state.gatewayUrl.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/setup/configure-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          model: model || undefined,
        }),
      });

      const result = await res.json();
      if (!result.ok) {
        props.onStateChange({ providerError: result.error ?? "配置失败" });
        return;
      }

      props.onStateChange({
        providerConfigured: true,
        providerError: null,
        currentStep: nextStep("provider", { ...state, providerConfigured: true }),
      });
    } catch (err) {
      props.onStateChange({
        providerError: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return html`
    <div class="setup-step">
      <h2>Step 4: 配置 AI Provider</h2>
      <p>选择一个 AI 服务商并配置 API Key</p>

      <div class="setup-form">
        <label class="field">
          <span>Provider</span>
          <select
            @change=${(e: Event) => {
              selectedProvider = (e.target as HTMLSelectElement).value;
            }}
          >
            ${PROVIDERS.map(
              (p) => html`<option value=${p.id}>${p.label}</option>`,
            )}
          </select>
        </label>

        <label class="field">
          <span>API Key</span>
          <input
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="sk-..."
            @input=${(e: Event) => {
              apiKey = (e.target as HTMLInputElement).value;
            }}
          />
        </label>

        <label class="field">
          <span>默认模型（可选）</span>
          <input
            type="text"
            placeholder="例如 claude-sonnet-4-6"
            @input=${(e: Event) => {
              model = (e.target as HTMLInputElement).value;
            }}
          />
        </label>
      </div>

      ${state.providerError
        ? html`<div class="setup-status setup-status--error">${state.providerError}</div>`
        : nothing}

      <div class="setup-wizard__actions">
        <button class="btn btn--primary" @click=${onSave}>
          保存配置
        </button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 3: 完成步骤**

```typescript
// ui/src/ui/views/setup/setup-step-complete.ts
import { html } from "lit";
import type { SetupWizardProps } from "./setup-wizard.js";
import type { Tab } from "../navigation.ts";

export function renderCompleteStep(props: SetupWizardProps) {
  const { state } = props;

  return html`
    <div class="setup-step">
      <h2>✓ 安装完成！</h2>
      <p>OpenClaw 已完成初始配置，以下是配置摘要：</p>

      <div class="setup-summary">
        <div class="setup-summary__item">
          <span class="setup-summary__label">uv 包管理器</span>
          <span class="setup-summary__value ${state.uvInstalled ? "ok" : "warn"}">
            ${state.uvInstalled ? "已安装" : "未安装"}
          </span>
        </div>
        <div class="setup-summary__item">
          <span class="setup-summary__label">预装技能</span>
          <span class="setup-summary__value ${state.skillsDeployed ? "ok" : "warn"}">
            ${state.skillsDeployed ? "已部署 (8 个)" : "未部署"}
          </span>
        </div>
        <div class="setup-summary__item">
          <span class="setup-summary__label">AI Provider</span>
          <span class="setup-summary__value ${state.providerConfigured ? "ok" : "warn"}">
            ${state.providerConfigured ? "已配置" : "未配置"}
          </span>
        </div>
      </div>

      <div class="setup-wizard__actions">
        <button
          class="btn btn--primary"
          @click=${() => props.onNavigate("overview" as Tab)}
        >
          进入控制面板
        </button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 4: 提交**

```bash
git add ui/src/ui/views/setup/setup-step-skills.ts ui/src/ui/views/setup/setup-step-provider.ts ui/src/ui/views/setup/setup-step-complete.ts
git commit -m "feat(ui): add skills, provider, and complete step components"
```

---

### Task 8: 集成到 App 渲染和首次运行检测

**Files:**
- Modify: `ui/src/ui/app-render.ts`
- Modify: `ui/src/ui/app-gateway.ts`

- [ ] **Step 1: 在 app-render.ts 中添加 setup 视图渲染**

找到 `state.tab === "overview"` 的渲染分支位置，在其附近添加：

```typescript
// 在 lazy loaders 区域添加
const lazySetup = createLazy(() => import("./views/setup/setup-wizard.js"));

// 在 tab 渲染区域添加（与 overview 同级）
${state.tab === "setup"
  ? lazyRender(lazySetup, (m) =>
      m.renderSetupWizard({
        state: setupWizardState,
        gatewayUrl: state.settings.gatewayUrl,
        onNavigate: (tab) => state.setTab(tab),
        onStateChange: (patch) => {
          Object.assign(setupWizardState, patch);
          state.requestUpdate?.();
        },
      }),
    )
  : nothing}
```

注意：需要在 `AppViewState` 或组件 state 中维护一个 `setupWizardState` 对象。

- [ ] **Step 2: 在 app-gateway.ts 中添加首次运行检测**

在连接失败的 catch 分支中添加 setup 重定向：

```typescript
// 在 connect 失败后检测是否需要 setup
try {
  const base = state.settings.gatewayUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/api/setup/status`);
  if (res.ok) {
    const data = await res.json();
    if (data.ok && !data.state.completed) {
      state.setTab("setup");
      return;
    }
  }
} catch {
  // Gateway 完全不可达，保持 login gate
}
```

- [ ] **Step 3: 导入 setup styles**

在 `ui/src/ui/app.ts` 或 `ui/src/ui/app-render.ts` 的顶部添加 CSS 导入：

```typescript
import "./views/setup/setup-styles.css";
```

- [ ] **Step 4: 验证 UI 编译和运行**

Run: `cd ui && pnpm build`
Expected: 编译通过

Run: `pnpm ui:dev`，手动访问 `http://localhost:5173/setup`
Expected: 显示安装向导界面

- [ ] **Step 5: 提交**

```bash
git add ui/src/ui/app-render.ts ui/src/ui/app-gateway.ts
git commit -m "feat(ui): integrate setup wizard into app rendering and first-run detection"
```

---

## Phase 3: 集成验证

### Task 9: 端到端验证

- [ ] **Step 1: 清除现有 setup 状态**

```bash
rm -rf ~/.openclaw/bin ~/.openclaw/skills ~/.openclaw/setup-state.json
```

- [ ] **Step 2: 启动 Gateway**

```bash
pnpm openclaw gateway run --bind loopback --port 18789 --force
```

- [ ] **Step 3: 验证 API 端点**

```bash
# 状态检查（应全部为 false）
curl http://127.0.0.1:18789/api/setup/status

# 下载 uv
curl -X POST http://127.0.0.1:18789/api/setup/download-uv

# 部署技能
curl -X POST http://127.0.0.1:18789/api/setup/deploy-skills

# 配置 Provider
curl -X POST http://127.0.0.1:18789/api/setup/configure-provider \
  -H "Content-Type: application/json" \
  -d '{"provider":"anthropic","apiKey":"test-key","model":"claude-sonnet-4-6"}'

# 最终状态（应 completed: true）
curl http://127.0.0.1:18789/api/setup/status
```

- [ ] **Step 4: 验证 UI 向导**

打开浏览器访问 `http://127.0.0.1:18789/`，应自动跳转到 `/setup`。
逐步完成向导流程，确认每步状态正确。

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "feat: complete web setup wizard with gateway API and UI"
```

---

## 自检清单

### Spec 覆盖度

| 方案要求 | 对应 Task |
|----------|-----------|
| `/api/setup/status` GET | Task 2 + Task 3 |
| `/api/setup/download-uv` POST + SSE | Task 2 + Task 3 |
| `/api/setup/deploy-skills` POST + SSE | Task 2 + Task 3 |
| `/api/setup/configure-provider` POST | Task 2 + Task 3 |
| Step 1: 环境检测 | Task 6 |
| Step 2: 安装 uv | Task 6 |
| Step 3: 部署技能 | Task 7 |
| Step 4: 配置 AI Provider | Task 7 |
| Step 5: 完成 | Task 7 |
| 首次运行检测 | Task 8 |
| 导航注册 | Task 4 |

### 类型一致性

- `SetupWizardState` 在 `setup-types.ts` 中定义，所有 step 组件通过 `SetupWizardProps.state` 引用
- `SetupState` 在 `setup-state.ts` 中定义，gateway 端点使用
- `Tab` 类型在 `navigation.ts` 中扩展了 `"setup"`
- SSE 事件格式统一为 `{ ok: boolean, ...fields }`
