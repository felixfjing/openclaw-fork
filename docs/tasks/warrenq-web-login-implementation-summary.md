# Warrenq Web 登录界面实施总结

**日期：** 2026年4月16日
**作者：** 胡丹
**状态：** 实施完成，待验证

---

## 实施概述

基于原始设计规格文档，修正了架构不匹配问题后，完成了 Warrenq Web 登录界面的实施。

### 关键架构修正

原始规格文档存在以下架构不匹配：

| 原始规格 | 实际架构 | 修正方案 |
|---------|---------|---------|
| React 组件 | Lit Web Components | 使用 Lit 创建 `<warrenq-login>` 组件 |
| Express 路由 | Gateway 插件 HTTP 路由 | 使用 `api.registerHttpRoute()` |
| 独立 HTML 页面 | Vite SPA 中的组件 | 嵌入配置视图的 Web Component |
| `/api/gildata/login` | `/plugins/gildata/login` | 遵循插件路由命名规范 |

## 创建的文件

### 1. 后端登录路由

**文件：** `extensions/gildata/src/login-route.ts`

- 处理 `POST /plugins/gildata/login` 请求
- 解析 JSON 请求体，验证用户名和密码
- 调用现有 `warrenqLoginClient.loginAndGetToken()` 完成认证
- Token 通过 `FileTokenStorage` 自动保存到 `~/.openclaw/gildata-token.json`
- 返回成功/失败 JSON 响应（不暴露完整 token）

### 2. 前端 Lit 登录组件

**文件：** `ui/src/ui/views/warrenq-login.ts`

- `@customElement("warrenq-login")` Web Component
- 内置 `static styles` 样式（暗色主题、响应式）
- 状态管理：idle / loading / success / error
- 密码显示/隐藏切换
- 通过 CustomEvent 通知父组件登录结果
- 调用 `/plugins/gildata/login` 后端路由

### 3. 测试文件

**文件：** `extensions/gildata/src/login-route.test.ts`

- 测试用例覆盖：非 POST 请求、无效 JSON、空用户名、空密码、过长用户名、登录成功、登录失败、自定义 baseUrl、用户名 trim

## 修改的文件

### 1. 插件入口

**文件：** `extensions/gildata/src/index.ts`

- 在 `register(api)` 中注册 HTTP 路由
- 使用懒加载模式：`auth: "plugin"`（用户未认证时可用）
- 路径：`/plugins/gildata/login`

### 2. 配置视图

**文件：** `ui/src/ui/views/config.ts`

- 导入 `<warrenq-login>` 组件
- 在连接信息区域下方添加 Warrenq 登录区块
- 登录成功后自动调用 `onReload()` 刷新配置

## 技术要点

### 后端代理的必要性

浏览器不能直接调用 Warrenq API（`pure.warrenq.com`），原因：
1. CORS 限制 — Warrenq API 不允许浏览器跨域请求
2. 安全性 — 凭证经过后端处理，不在浏览器 JS 中暴露

### 认证流程

```
浏览器 (Lit 组件)
    │ fetch('/plugins/gildata/login')
    ▼
Gateway 插件 HTTP 路由 (Node.js)
    │ handleLoginRoute()
    ▼
warrenqLoginClient.loginAndGetToken()
    │
    ▼
Warrenq API (pure.warrenq.com)
    │
    ▼
FileTokenStorage → ~/.openclaw/gildata-token.json
```

### 插件边界合规

- 扩展代码仅导入 `openclaw/plugin-sdk/*` 和本地模块
- HTTP 路由通过 `api.registerHttpRoute()` 注册
- 不导入核心内部代码 `src/**`

## 待办事项

1. **运行时验证** — 需要 Node.js >= 22.14.0 和 `pnpm install` 后运行测试
2. **构建验证** — 运行 `pnpm build` 验证 TypeScript 编译
3. **端到端测试** — 启动 Gateway 后在浏览器中验证完整登录流程
4. **i18n** — 当前组件使用硬编码中文，可考虑集成到 i18n 系统
5. **CSRF 防护** — 如需生产部署，考虑添加 CSRF token

## 验证命令

```bash
# 安装依赖
pnpm install

# 类型检查
pnpm build

# 运行测试
pnpm test extensions/gildata/src/login-route.test.ts

# 启动 Gateway
openclaw gateway run --bind loopback --port 18789

# 打开 UI 测试
openclaw dashboard
```
