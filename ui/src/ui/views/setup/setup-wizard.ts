import { html, nothing } from "lit";
import type { Tab } from "../../navigation.ts";
import {
  type SetupWizardState,
  type SetupStep,
  SETUP_STEPS,
} from "./setup-types.ts";

export interface SetupWizardProps {
  state: SetupWizardState;
  gatewayUrl: string;
  onNavigate: (tab: Tab) => void;
  onStateChange: (patch: Partial<SetupWizardState>) => void;
}

/** 将 WebSocket URL 转换为 HTTP URL */
function wsToHttp(url: string): string {
  return url.replace(/^ws(s?):\/\//, "http$1://").replace(/\/+$/, "");
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
        ${renderCurrentStep(props)}
      </div>
    </div>
  `;
}

function renderCurrentStep(props: SetupWizardProps) {
  const { state } = props;

  switch (state.currentStep) {
    case "check":
      return renderCheckStep(props);
    case "uv":
      return renderUvStep(props);
    case "skills":
      return renderSkillsStep(props);
    case "provider":
      return renderProviderStep(props);
    case "complete":
      return renderCompleteStep(props);
    default:
      return nothing;
  }
}

// ── 临时 stub — 将在后续 Task 中替换为独立文件的 import ──────────────

function renderCheckStep(props: SetupWizardProps) {
  const onCheck = async () => {
    try {
      const base = wsToHttp(props.state.gatewayUrl);
      const res = await fetch(`${base}/api/setup/status`);
      if (!res.ok) throw new Error(`状态检查失败: ${res.status}`);
      const result = await res.json();
      const { nextStep } = await import("./setup-types.ts");
      props.onStateChange({
        uvInstalled: result.uvInstalled,
        skillsDeployed: result.skillsDeployed,
        providerConfigured: result.providerConfigured,
        completed: result.completed,
        currentStep: nextStep("check", {
          ...props.state,
          uvInstalled: result.uvInstalled,
          skillsDeployed: result.skillsDeployed,
          providerConfigured: result.providerConfigured,
          completed: result.completed,
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
        <div
          class="setup-check-item ${props.state.uvInstalled ? "ok" : "pending"}"
        >
          <span>${props.state.uvInstalled ? "✓" : "○"}</span>
          <span>uv 包管理器</span>
        </div>
        <div
          class="setup-check-item ${props.state.skillsDeployed
            ? "ok"
            : "pending"}"
        >
          <span>${props.state.skillsDeployed ? "✓" : "○"}</span>
          <span>预装技能</span>
        </div>
        <div
          class="setup-check-item ${props.state.providerConfigured
            ? "ok"
            : "pending"}"
        >
          <span>${props.state.providerConfigured ? "✓" : "○"}</span>
          <span>AI Provider 配置</span>
        </div>
      </div>
      <div class="setup-wizard__actions">
        <button class="btn btn--primary" @click=${onCheck}>开始检测</button>
      </div>
    </div>
  `;
}

function renderUvStep(props: SetupWizardProps) {
  const { state } = props;

  const onInstall = async () => {
    props.onStateChange({ uvProgress: "下载中..." });
    try {
      const base = wsToHttp(state.gatewayUrl);
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
            const { nextStep } = await import("./setup-types.ts");
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
                @click=${async () => {
                  const { nextStep } = await import("./setup-types.ts");
                  props.onStateChange({ currentStep: nextStep("uv", state) });
                }}
              >下一步</button>
            </div>
          `
        : html`
            ${state.uvProgress
              ? html`<div class="setup-progress"><span>${state.uvProgress}</span></div>`
              : nothing}
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                ?disabled=${state.uvProgress !== null}
                @click=${onInstall}
              >${state.uvProgress ? "安装中..." : "安装 uv"}</button>
            </div>
          `}
    </div>
  `;
}

function renderSkillsStep(props: SetupWizardProps) {
  const { state } = props;

  const SKILL_NAMES = [
    "pdf", "xlsx", "docx", "pptx",
    "find-skills", "self-improving-agent",
    "tavily-search", "brave-web-search",
  ];

  const onDeploy = async () => {
    props.onStateChange({ skillsProgress: "部署中..." });
    try {
      const base = wsToHttp(state.gatewayUrl);
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
            const { nextStep } = await import("./setup-types.ts");
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

  return html`
    <div class="setup-step">
      <h2>Step 3: 部署技能</h2>
      <p>部署预装技能，支持文档处理、网络搜索等功能</p>
      ${state.skillsDeployed
        ? html`
            <div class="setup-status setup-status--ok">
              <span>✓</span> 技能已部署
            </div>
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                @click=${async () => {
                  const { nextStep } = await import("./setup-types.ts");
                  props.onStateChange({ currentStep: nextStep("skills", state) });
                }}
              >下一步</button>
            </div>
          `
        : html`
            <div class="setup-skills-list">
              <h4>即将部署的技能：</h4>
              <ul>
                ${SKILL_NAMES.map((name) => html`<li>${name}</li>`)}
              </ul>
            </div>
            ${state.skillsProgress
              ? html`<div class="setup-progress"><span>${state.skillsProgress}</span></div>`
              : nothing}
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                ?disabled=${state.skillsProgress !== null}
                @click=${onDeploy}
              >${state.skillsProgress ? "部署中..." : "部署技能"}</button>
            </div>
          `}
    </div>
  `;
}

function renderProviderStep(props: SetupWizardProps) {
  const { state } = props;

  const PROVIDERS = ["anthropic", "openai", "azure-openai", "custom"] as const;

  const onSave = async (ev: Event) => {
    const form = (ev.target as HTMLButtonElement).closest("form");
    if (!form) return;
    const formData = new FormData(form);
    const provider = formData.get("provider") as string;
    const apiKey = formData.get("apiKey") as string;
    const model = formData.get("model") as string;

    if (!provider || !apiKey) {
      props.onStateChange({ providerError: "请填写 Provider 和 API Key" });
      return;
    }

    props.onStateChange({ providerError: null });

    try {
      const base = wsToHttp(state.gatewayUrl);
      const res = await fetch(`${base}/api/setup/configure-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const { nextStep } = await import("./setup-types.ts");
      props.onStateChange({
        providerConfigured: true,
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
      <p>选择并配置 AI 模型供应商</p>
      ${state.providerConfigured
        ? html`
            <div class="setup-status setup-status--ok">
              <span>✓</span> AI Provider 已配置
            </div>
            <div class="setup-wizard__actions">
              <button
                class="btn btn--primary"
                @click=${async () => {
                  const { nextStep } = await import("./setup-types.ts");
                  props.onStateChange({ currentStep: nextStep("provider", state) });
                }}
              >下一步</button>
            </div>
          `
        : html`
            <form class="setup-provider-form" @submit=${(e: Event) => e.preventDefault()}>
              <div class="setup-form-group">
                <label for="setup-provider">Provider</label>
                <select id="setup-provider" name="provider" class="setup-input" required>
                  ${PROVIDERS.map(
                    (p) => html`<option value=${p}>${p}</option>`,
                  )}
                </select>
              </div>
              <div class="setup-form-group">
                <label for="setup-apikey">API Key</label>
                <input
                  id="setup-apikey"
                  name="apiKey"
                  type="password"
                  class="setup-input"
                  placeholder="输入 API Key"
                  required
                />
              </div>
              <div class="setup-form-group">
                <label for="setup-model">默认模型</label>
                <input
                  id="setup-model"
                  name="model"
                  type="text"
                  class="setup-input"
                  placeholder="例如: claude-sonnet-4-20250514"
                />
              </div>
              ${state.providerError
                ? html`<div class="setup-error">${state.providerError}</div>`
                : nothing}
              <div class="setup-wizard__actions">
                <button class="btn btn--primary" @click=${onSave}>保存配置</button>
              </div>
            </form>
          `}
    </div>
  `;
}

function renderCompleteStep(props: SetupWizardProps) {
  const { state } = props;

  return html`
    <div class="setup-step">
      <h2>Step 5: 配置完成</h2>
      <p>恭喜！所有配置已完成，以下是配置摘要：</p>
      <div class="setup-check-list">
        <div class="setup-check-item ${state.uvInstalled ? "ok" : "pending"}">
          <span>${state.uvInstalled ? "✓" : "○"}</span>
          <span>uv 包管理器${state.uvInstalled ? " — 已安装" : " — 未安装"}</span>
        </div>
        <div class="setup-check-item ${state.skillsDeployed ? "ok" : "pending"}">
          <span>${state.skillsDeployed ? "✓" : "○"}</span>
          <span>预装技能${state.skillsDeployed ? " — 已部署" : " — 未部署"}</span>
        </div>
        <div class="setup-check-item ${state.providerConfigured ? "ok" : "pending"}">
          <span>${state.providerConfigured ? "✓" : "○"}</span>
          <span>AI Provider${state.providerConfigured ? " — 已配置" : " — 未配置"}</span>
        </div>
      </div>
      <div class="setup-wizard__actions">
        <button
          class="btn btn--primary"
          @click=${() => props.onNavigate("overview" as Tab)}
        >进入控制面板</button>
      </div>
    </div>
  `;
}
