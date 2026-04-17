# OpenClaw - Claude Code 指南

> 本文件专为 Claude Code 交互式开发助手优化。自动化代理请参阅 `AGENTS.md`。

## 项目简介

OpenClaw 是一个多渠道 AI 网关，支持可扩展的消息集成。核心功能：
- 多渠道消息接入（Telegram、Discord、Slack、Signal、iMessage、WhatsApp Web 等）
- 可插拔的 Provider 系统（AI 模型供应商）
- 插件/扩展架构（第三方可开发插件）
- Gateway 控制平面和节点协议

## 技术栈速查

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript (ESM) |
| 运行时 | Node 22+, Bun |
| 包管理 | pnpm |
| 框架 | Express |
| 测试 | Vitest (V8 coverage) |
| 构建 | tsdown |
| 格式化/检查 | Oxlint + Oxfmt |
| Schema 验证 | Zod |
| 移动端 | SwiftUI (iOS/macOS), Compose Multiplatform (Android) |

## 目录结构

```
openclaw/
├── src/                  # 核心源码
│   ├── cli/              # CLI 命令行入口
│   ├── commands/         # CLI 命令实现
│   ├── channels/         # 核心渠道实现（非插件）
│   ├── plugins/          # 插件发现、加载、注册
│   ├── plugin-sdk/       # 插件公共 SDK（扩展可导入）
│   ├── gateway/          # Gateway 控制平面
│   ├── infra/            # 基础设施
│   └── media/            # 媒体管道
├── extensions/           # 捆绑的工作区插件
├── apps/                 # 移动端/桌面端应用
├── docs/                 # 文档
├── test/                 # 测试辅助
├── scripts/              # 构建和工具脚本
├── ui/                   # 控制面板 UI
└── skills/               # 技能定义
```

## 常用任务速查

### 添加新插件/扩展

1. 在 `extensions/` 下创建目录
2. 创建 `openclaw.plugin.json`（manifest）和 `package.json`
3. 在 `src/index.ts` 中使用 `definePluginEntry()` 注册
4. 插件只能导入 `openclaw/plugin-sdk/*` 和本地 barrel 文件
5. 运行 `pnpm check` 验证

### 添加新消息渠道

1. 在 `src/channels/` 下创建模块（核心渠道）或在 `extensions/` 下创建插件渠道
2. 更新 `.github/labeler.yml` 添加对应标签
3. 更新所有 UI 表面（macOS、web、mobile）
4. 参考 `docs/plugins/sdk-channel-plugins.md`

### 添加新 Provider

1. 在 `extensions/` 下创建 provider 插件
2. 实现 `registerProvider()` 的 auth/discovery/prepareRuntimeAuth 等 hook
3. 参考 `docs/plugins/sdk-provider-plugins.md`

### 调试网关问题

```bash
# 查看网关状态
openclaw channels status --probe

# 查看网关日志
tail -n 120 /tmp/openclaw-gateway.log

# 检查端口监听
ss -ltnp | rg 18789

# 重启网关
pkill -9 -f openclaw-gateway || true
nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &
```

### 运行测试

```bash
pnpm test                                    # 全量测试
pnpm test src/some/path.test.ts              # 指定文件
pnpm test src/some/path.test.ts -t "test name"  # 指定测试名
pnpm test:coverage                           # 带覆盖率
OPENCLAW_LIVE_TEST=1 pnpm test:live          # Live 测试（需要真实密钥）
```

### 构建和检查

```bash
pnpm build          # 类型检查 + 构建
pnpm check          # lint + 格式检查
pnpm format         # 检查格式
pnpm format:fix     # 修复格式
pnpm tsgo           # TypeScript 类型检查
```

## 故障排除

### 构建失败

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `vitest not found` | node_modules 缺失 | 运行 `pnpm install` |
| `[INEFFECTIVE_DYNAMIC_IMPORT]` | 动态导入边界错误 | 创建 `*.runtime.ts` 边界文件 |
| import cycle 错误 | 循环依赖 | 运行 `pnpm check:import-cycles` 定位 |
| 类型错误 | 类型不匹配 | 先修根类型文件，再修下游 |

### 测试失败

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 测试超时 | 模块级 mock 问题 | 检查是否在 `beforeEach` 中重置重模块 |
| `vi.resetModules` 慢 | 每次测试重建模块图 | 改用 `beforeAll` 导入，`beforeEach` 重置 mock |
| 内存压力 | Worker 过多 | 设置 `OPENCLAW_VITEST_MAX_WORKERS=1` |

### Docker 问题

| 错误 | 解决方案 |
|------|----------|
| 容器启动失败 | 检查 `docker-compose.yml` 中端口映射和环境变量 |
| 权限错误 | 确保 `docker-setup.sh` 有执行权限 |
| 网络问题 | 检查 `Dockerfile.sandbox` 和 `Dockerfile.sandbox-common` |

## 核心规则

### 架构边界

- **扩展**只能通过 `openclaw/plugin-sdk/*` 和本地 barrel（`api.ts`、`runtime-api.ts`）与核心交互
- **核心代码**不得导入扩展内部（`extensions/*/src/**`）
- 不要在核心中硬编码扩展/provider/channel ID 列表
- 新增插件公共接口必须通过 `plugin-sdk` 子路径导出，并保持向后兼容

### 编码规范

- 严格类型，避免 `any`；不加 `@ts-nocheck`
- 优先使用 Zod schema 验证外部边界数据
- 使用 `Result<T, E>` 风格处理可恢复错误
- 不可变模式：创建新对象而非修改原对象
- 文件保持 ~700 行以内，提取辅助函数
- 代码注释使用中文，变量/函数名使用英文

### 提交规范

```
<type>(<scope>): <description>

type: feat, fix, refactor, docs, test, chore, perf, ci
```

- 提交前运行 `pnpm check`
- 使用 `scripts/committer "<msg>" <file...>` 提交
- 不要自动 push，commit 后等确认
- 不在 main 上创建 merge commit，使用 rebase

### 测试要求

- 覆盖率目标：70%+ (lines/branches/functions/statements)
- 测试文件命名：`*.test.ts`（E2E: `*.e2e.test.ts`）
- 测试必须清理定时器、环境变量、全局 mock、socket 和临时目录
- 示例模型常量使用 `sonnet-4.6` 和 `gpt-5.4`

### 安全

- 不硬编码密钥（API key、密码、token）
- 所有用户输入需验证
- 使用环境变量或 Secret 管理器存储密钥
- 错误信息不泄露敏感数据

## 关键文件索引

| 用途 | 路径 |
|------|------|
| 插件入口定义 | `src/plugin-sdk/plugin-entry.ts` |
| Provider 入口 | `src/plugin-sdk/provider-entry.ts` |
| 插件注册表 | `src/plugins/contracts/registry.ts` |
| 配置类型 | `src/plugin-sdk/core.ts` |
| Gateway 协议 | `src/gateway/protocol/schema.ts` |
| 测试辅助 | `test/helpers/` |

## 分层指南

详细规则在分层 AGENTS.md 中，按需阅读：

| 范围 | 文件 | 关注点 |
|------|------|--------|
| 扩展边界 | `extensions/AGENTS.md` | 插件开发规则 |
| Plugin SDK | `src/plugin-sdk/AGENTS.md` | 公共 SDK 契约 |
| 渠道实现 | `src/channels/AGENTS.md` | 核心渠道热路径 |
| 插件加载 | `src/plugins/AGENTS.md` | 发现、验证、注册 |
| Gateway 协议 | `src/gateway/protocol/AGENTS.md` | 线协议 |
| 测试辅助 | `test/helpers/AGENTS.md` | 共享测试工具 |
| 文档维护 | `docs/AGENTS.md` | 文档和 i18n |
| UI | `ui/AGENTS.md` | 控制面板 |
