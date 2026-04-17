# Gildata Provider 插件指南

> 本文件指导 Claude Code 在 `extensions/gildata/` 下的开发工作。

## 插件概述

Gildata 是一个 AI 服务 Provider 插件，通过 WarrenQ 系统进行认证，提供模型发现和推理能力。支持两种认证模式：

1. **WarrenQ 完整认证** — 通过 C# 终端登录流程获取 token
2. **API Key 认证** — 直接使用 API 密钥

## 目录结构

```
extensions/gildata/
├── openclaw.plugin.json     # 插件 manifest（ID、配置 schema、认证选择）
├── package.json             # 包依赖
├── tsconfig.json            # TypeScript 配置
├── src/
│   ├── index.ts             # 插件入口，注册 Provider hooks
│   ├── api.ts               # Provider 核心 API（发现、认证、模型准备）
│   ├── types.ts             # 类型定义（日志级别、认证事件等）
│   ├── warrenq-auth.ts      # WarrenQ 认证逻辑（头部构建、配置验证）
│   ├── warrenq-login.ts     # WarrenQ 登录和 Token 管理（文件/内存存储）
│   ├── warrenq-auth-error.ts # 认证错误类型和错误码
│   ├── dynamic-models.ts    # 动态模型发现和别名映射
│   ├── http-client.ts       # HTTP 请求封装（登录、租户信息）
│   ├── logger.ts            # 结构化日志（关联 ID、脱敏）
│   ├── cache-manager.ts     # 缓存管理
│   ├── performance-monitor.ts # 性能监控
│   ├── retry-utils.ts       # 重试策略工具
│   └── *.test.ts            # 测试文件
└── docs/                    # 扩展文档
```

## 架构

### 认证流程（WarrenQ 模式）

```
用户配置 autoLogin=true + username/password
    │
    ▼
warrenq-login.ts: 登录请求 → 获取 access_token
    │
    ▼
warrenq-login.ts: 获取租户信息 → tenantId, userId
    │
    ▼
Token 存储（文件存储 或 内存存储）
    │
    ▼
api.ts: discoverGildataProvider() → 模型发现
    │
    ▼
api.ts: prepareGildataRuntimeAuth() → 运行时认证头构建
    │
    ▼
请求发送（带 Authorization + X-* 头部）
```

### Provider 注册流程

`index.ts` 使用 `definePluginEntry()` 注册以下 hooks：

| Hook | 作用 |
|------|------|
| `auth` | 交互式/非交互式认证配置 |
| `discovery` | Provider 发现（获取可用模型列表） |
| `resolveSyntheticAuth` | 解析合成认证信息 |
| `prepareRuntimeAuth` | 准备运行时认证（API Key 或 WarrenQ token） |
| `prepareDynamicModel` | 获取动态模型并缓存 |
| `resolveDynamicModel` | 从缓存中解析模型 |
| `augmentModelCatalog` | 增强模型目录（别名映射） |

## 配置 Schema

关键配置项（定义在 `openclaw.plugin.json`）：

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `autoLogin` | `false` | 启用 WarrenQ 自动登录 |
| `loginBaseUrl` | `https://api.warrenq.com` | WarrenQ 登录 API 地址 |
| `chatBaseUrl` | `http://aigwtest.in.gildata.com:31088/...` | 聊天 API 地址 |
| `agentId` | `gildata-claw` | Agent-Id 标识 |
| `moduleId` | `claw` | X-Module-Id |
| `customHeaders` | `{}` | 自定义 HTTP 头 |

环境变量：`GILDATA_API_TOKEN`、`warrenq_USERNAME`、`warrenq_PASSWORD`

## 开发规则

### 导入边界

- 只允许导入 `openclaw/plugin-sdk/*` 和本地模块（`./xxx.js`）
- 不导入 `src/**` 或其他扩展的内部代码
- 本地 barrel：`./api.ts` 是对外暴露的公共接口

### 错误处理

- 使用 `warrenq-auth-error.ts` 中定义的结构化错误类型
- 所有 API 调用需要关联 ID（`generateCorrelationId()`）
- 日志使用 `./logger.ts`，不要使用 `console.log`

### Token 存储

- `FileTokenStorage` — 持久化到 `~/.openclaw/credentials/`
- `MemoryTokenStorage` — 内存中临时存储
- Token 包含 `access_token`、`tenantId`、`userId`

### 测试

| 文件 | 覆盖范围 |
|------|----------|
| `index.test.ts` | 插件入口和注册 |
| `api.test.ts` | Provider API 逻辑 |
| `warrenq-auth.test.ts` | WarrenQ 认证逻辑 |
| `warrenq-auth-error.test.ts` | 错误类型和错误码 |
| `dynamic-models.test.ts` | 动态模型发现 |
| `performance-cache.test.ts` | 缓存和性能监控 |
| `token-storage.test.ts` | Token 存储读写 |
| `logger.test.ts` | 日志系统 |
| `warrenq-auth.e2e.test.ts` | E2E 认证流程（需 live 环境） |

运行测试：
```bash
pnpm test extensions/gildata/
```

## 常见操作

### 添加新的模型别名

在 `dynamic-models.ts` 中的 `GILDATA_MODEL_ALIASES` 和 `GILDATA_MODEL_TO_ALIAS` 添加映射。

### 修改认证流程

1. `warrenq-login.ts` — 登录请求和响应处理
2. `warrenq-auth.ts` — 认证配置和头部构建
3. `warrenq-auth-error.ts` — 新增错误码（如需要）
4. 更新对应的 `.test.ts` 文件

### 添加新的配置项

1. 在 `openclaw.plugin.json` 的 `configSchema.properties` 中添加
2. 在 `types.ts` 中更新类型（如需要）
3. 在 `api.ts` 对应的函数中读取新配置
4. 添加测试验证
