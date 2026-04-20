/**
 * Warrenq 登录 Lit 组件
 *
 * 独立的 Web Component，嵌入到 OpenClaw 配置视图中。
 * 提供用户名/密码表单，通过后端代理调用 Warrenq API 完成认证。
 */
import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { normalizeBasePath } from "../navigation.js";

/** 登录状态枚举 */
type LoginStatus = "idle" | "loading" | "success" | "error";

/** 登录成功事件 detail */
interface LoginSuccessDetail {
  userId: string;
  tenantId: string;
}

/**
 * Warrenq 登录对话框组件
 *
 * 使用方式:
 * ```html
 * <warrenq-login basepath="/openclaw"></warrenq-login>
 * ```
 *
 * 事件:
 * - `warrenq-login-success`: 登录成功时触发，detail 包含 userId 和 tenantId
 * - `warrenq-login-cancel`: 用户取消登录时触发
 */
@customElement("warrenq-login")
export class WarrenqLogin extends LitElement {
  /** Gateway basePath，用于构建 API URL */
  @property({ type: String })
  basePath = "";

  /** 登录状态 */
  @state()
  private status: LoginStatus = "idle";

  /** 错误消息 */
  @state()
  private errorMessage = "";

  /** 用户名输入值 */
  @state()
  private username = "";

  /** 密码输入值 */
  @state()
  private password = "";

  /** 是否显示密码明文 */
  @state()
  private showPassword = false;

  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .login-card {
      background: var(--card-bg, #1a1a2e);
      border: 1px solid var(--border, #333);
      border-radius: 12px;
      padding: 32px;
      max-width: 380px;
      width: 100%;
      margin: 0 auto;
    }

    .login-card__header {
      text-align: center;
      margin-bottom: 24px;
    }

    .login-card__title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary, #e0e0e0);
      margin: 0 0 4px;
    }

    .login-card__subtitle {
      font-size: 13px;
      color: var(--text-secondary, #888);
      margin: 0;
    }

    .field {
      margin-bottom: 16px;
    }

    .field label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary, #aaa);
      margin-bottom: 6px;
    }

    .field__input-wrapper {
      position: relative;
    }

    .field input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border, #333);
      border-radius: 6px;
      background: var(--input-bg, #0d1117);
      color: var(--text-primary, #e0e0e0);
      font-size: 14px;
      box-sizing: border-box;
      transition: border-color 0.15s ease;
    }

    .field input:focus {
      outline: none;
      border-color: var(--accent, #667eea);
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
    }

    .field input::placeholder {
      color: var(--text-muted, #555);
    }

    .toggle-password {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      line-height: 1;
    }

    .toggle-password:hover {
      color: var(--text-primary, #e0e0e0);
    }

    .btn {
      width: 100%;
      padding: 11px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, opacity 0.15s ease;
    }

    .btn--primary {
      background: var(--accent, #667eea);
      color: #fff;
    }

    .btn--primary:hover:not(:disabled) {
      background: var(--accent-hover, #5a6fd6);
    }

    .btn--primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn--ghost {
      background: transparent;
      color: var(--text-secondary, #888);
      margin-top: 8px;
    }

    .btn--ghost:hover {
      color: var(--text-primary, #e0e0e0);
    }

    .error {
      padding: 10px 12px;
      background: rgba(220, 38, 38, 0.1);
      border: 1px solid rgba(220, 38, 38, 0.3);
      border-radius: 6px;
      color: #f87171;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .success {
      padding: 10px 12px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 6px;
      color: #34d399;
      font-size: 13px;
      text-align: center;
      margin-bottom: 16px;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  private handleSubmit(e: Event): void {
    e.preventDefault();

    // 前端输入验证
    if (!this.username.trim()) {
      this.errorMessage = "请输入用户名";
      this.status = "error";
      return;
    }

    if (!this.password) {
      this.errorMessage = "请输入密码";
      this.status = "error";
      return;
    }

    this.errorMessage = "";
    this.status = "loading";
    this.performLogin();
  }

  private async performLogin(): Promise<void> {
    const bp = normalizeBasePath(this.basePath);
    const url = bp ? `${bp}/plugins/gildata/login` : "/plugins/gildata/login";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: this.username.trim(),
          password: this.password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        this.status = "success";

        // 派发登录成功事件
        this.dispatchEvent(
          new CustomEvent<LoginSuccessDetail>("warrenq-login-success", {
            detail: {
              userId: data.data?.userId ?? "",
              tenantId: data.data?.tenantId ?? "",
            },
            bubbles: true,
            composed: true,
          }),
        );

        // 登录成功后延迟跳转到综合助手聊天页面
        setTimeout(() => {
          const bp = normalizeBasePath(this.basePath);
          const chatUrl = bp ? `${bp}/chat/standalone` : "/chat/standalone";
          window.location.href = chatUrl;
        }, 1500);
      } else {
        this.status = "error";
        this.errorMessage = data.message || "登录失败，请重试";
      }
    } catch {
      this.status = "error";
      this.errorMessage = "网络错误，请检查连接后重试";
    }
  }

  private handleCancel(): void {
    this.dispatchEvent(
      new CustomEvent("warrenq-login-cancel", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleUsernameInput(e: Event): void {
    this.username = (e.target as HTMLInputElement).value;
    if (this.status === "error") {
      this.status = "idle";
      this.errorMessage = "";
    }
  }

  private handlePasswordInput(e: Event): void {
    this.password = (e.target as HTMLInputElement).value;
    if (this.status === "error") {
      this.status = "idle";
      this.errorMessage = "";
    }
  }

  private toggleShowPassword(): void {
    this.showPassword = !this.showPassword;
  }

  render() {
    const isLoading = this.status === "loading";
    const isSuccess = this.status === "success";

    return html`
      <div class="login-card">
        <div class="login-card__header">
          <h2 class="login-card__title">Warrenq 登录</h2>
          <p class="login-card__subtitle">Gildata 认证服务</p>
        </div>

        ${isSuccess
          ? html`
            <div class="success">登录成功！正在跳转...</div>
          `
          : html`
            ${this.errorMessage
              ? html`<div class="error">${this.errorMessage}</div>`
              : ""}

            <form @submit=${this.handleSubmit}>
              <div class="field">
                <label for="warrenq-username">用户名</label>
                <input
                  id="warrenq-username"
                  type="text"
                  .value=${this.username}
                  @input=${this.handleUsernameInput}
                  placeholder="请输入用户名或手机号"
                  autocomplete="username"
                  ?disabled=${isLoading}
                />
              </div>

              <div class="field">
                <label for="warrenq-password">密码</label>
                <div class="field__input-wrapper">
                  <input
                    id="warrenq-password"
                    type=${this.showPassword ? "text" : "password"}
                    .value=${this.password}
                    @input=${this.handlePasswordInput}
                    placeholder="请输入密码"
                    autocomplete="current-password"
                    ?disabled=${isLoading}
                  />
                  <button
                    type="button"
                    class="toggle-password"
                    @click=${this.toggleShowPassword}
                    aria-label=${this.showPassword ? "隐藏密码" : "显示密码"}
                  >
                    ${this.showPassword ? "\u{1F441}" : "\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}\u{FE0F}"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                class="btn btn--primary"
                ?disabled=${isLoading}
              >
                ${isLoading
                  ? html`<span class="spinner"></span>登录中...`
                  : "登录"}
              </button>

              <button
                type="button"
                class="btn btn--ghost"
                ?disabled=${isLoading}
                @click=${this.handleCancel}
              >
                取消
              </button>
            </form>
          `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "warrenq-login": WarrenqLogin;
  }
}
