# OpenClaw 数据存储结构分析

> 作者：胡丹
> 创建日期：2026-04-14

## 概述

OpenClaw 系统运行后的业务数据默认存储在用户主目录下的 `.openclaw` 目录中。所有数据存储位置都可以通过环境变量进行自定义。

## 核心目录结构

### 默认状态目录：`~/.openclaw`

```
~/.openclaw/
├── openclaw.json              # 主配置文件
├── agents/                   # 代理会话数据
│   └── default/              # 默认代理（DEFAULT_AGENT_ID）
│       └── sessions/        # 会话转储
│           ├── sessions.json  # 会话索引
│           └── *.jsonl      # 各会话详细数据（JSONL 格式）
├── credentials/              # OAuth 凭证和敏感数据
│   └── oauth.json          # OAuth 令牌存储
├── media/                   # 媒体缓存
├── canvas/                  # Canvas 主机数据
├── workspace/               # 工作区数据
├── sandboxes/               # 沙箱隔离数据
├── logs/                    # 日志文件
└── nodes/                   # 节点数据（如果启用）
```

## 各数据类型的存储位置详解

### 1. 配置文件

**位置：** `~/.openclaw/openclaw.json`

**关键代码：** `src/config/paths.ts:106-114`

```typescript
export function resolveCanonicalConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.OPENCLAW_CONFIG_PATH?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, CONFIG_FILENAME);  // openclaw.json
}
```

**覆盖方式：**
- 环境变量：`OPENCLAW_CONFIG_PATH=/custom/path/config.json`
- 支持多配置文件模式（`--profile` 参数）

### 2. 会话数据

**位置：** `~/.openclaw/agents/<agentId>/sessions/`

**关键代码：** `src/config/sessions/paths.ts:9-16`

```typescript
function resolveAgentSessionsDir(
  agentId?: string,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = () => resolveRequiredHomeDir(env, os.homedir),
): string {
  const root = resolveStateDir(env, homedir);
  const id = normalizeAgentId(agentId ?? DEFAULT_AGENT_ID);
  return path.join(root, "agents", id, "sessions");
}
```

**文件结构：**
```
~/.openclaw/agents/default/sessions/
├── sessions.json              # 会话索引和元数据
├── session-id.jsonl          # 单会话转储（JSONL 格式）
└── session-id-topic-99.jsonl  # 话题会话
```

**会话 ID 格式：** `src/config/sessions/paths.ts:61`
- 正则：`/^[a-z0-9][a-z0-9._-]{0,127}$/i`
- 长度：0-127 字符
- 示例：`abc-123`, `my_session`, `test.session`

### 3. 媒体和缓存数据

**媒体本地根目录：** `src/media/local-roots.ts:30-48`

```typescript
export function buildMediaLocalRoots(
  stateDir: string,
  configDir: string,
  options: BuildMediaLocalRootsOptions = {},
): string[] {
  return Array.from(
    new Set([
      preferredTmpDir,              // 临时目录（优先）
      path.join(resolvedConfigDir, "media"),
      path.join(resolvedStateDir, "media"),
      path.join(resolvedStateDir, "canvas"),
      path.join(resolvedStateDir, "workspace"),
      path.join(resolvedStateDir, "sandboxes"),
    ]),
  );
}
```

**搜索顺序：**
1. 系统临时目录（通过 `resolvePreferredOpenClawTmpDir()`）
2. `$CONFIG_DIR/media`
3. `$STATE_DIR/media`
4. `$STATE_DIR/canvas`
5. `$STATE_DIR/workspace`
6. `$STATE_DIR/sandboxes`

### 4. OAuth 凭证和敏感数据

**位置：** `~/.openclaw/credentials/oauth.json`

**关键代码：** `src/config/paths.ts:236-244`

```typescript
export function resolveOAuthDir(
  env: NodeJS.ProcessEnv = process.env,
  stateDir: string = resolveStateDir(env, envHomedir(env)),
): string {
  const override = env.OPENCLAW_OAUTH_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, envHomedir(env));
  }
  return path.join(stateDir, "credentials");
}
```

**覆盖方式：**
- 环境变量：`OPENCLAW_OAUTH_DIR=/custom/credentials`

### 5. 网关锁定文件

**位置：** `$TMPDIR/openclaw-<uid>`

**关键代码：** `src/config/paths.ts:220-224`

```typescript
export function resolveGatewayLockDir(tmpdir: () => string = os.tmpdir): string {
  const base = tmpdir();
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  const suffix = uid != null ? `openclaw-${uid}` : "openclaw";
  return path.join(base, suffix);
}
```

**用途：** 临时锁定文件，防止网关重复启动

### 6. 日志文件

**位置：** `~/.openclaw/logs/`

**典型日志文件：**
- `cache-trace.jsonl` - 缓存追踪日志
- `gateway.log` - 网关运行日志
- 各通道特定的日志文件

## 环境变量覆盖

| 环境变量 | 作用 | 默认值 |
|-----------|------|---------|
| `OPENCLAW_STATE_DIR` | 状态目录根目录 | `~/.openclaw` |
| `OPENCLAW_CONFIG_PATH` | 配置文件路径 | `~/.openclaw/openclaw.json` |
| `OPENCLAW_OAUTH_DIR` | OAuth 凭证目录 | `$STATE_DIR/credentials` |
| `OPENCLAW_HOME` | 主目录（路径解析） | `$HOME` |

**使用示例：**

```bash
# 自定义状态目录
export OPENCLAW_STATE_DIR=/custom/openclaw-state

# 自定义配置文件
export OPENCLAW_CONFIG_PATH=/custom/openclaw-config.json

# 自定义凭证目录
export OPENCLAW_OAUTH_DIR=/custom/oauth-credentials

# 运行 OpenClaw
openclaw gateway --port 19001
```

## 多实例配置

多个 OpenClaw 实例可以共存，使用不同的状态目录和配置：

```bash
# 实例 A
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json \
OPENCLAW_STATE_DIR=~/.openclaw-a \
openclaw gateway --port 19001

# 实例 B
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json \
OPENCLAW_STATE_DIR=~/.openclaw-b \
openclaw gateway --port 19002
```

## 数据文件格式

### JSONL (JSON Lines)

**用途：** 会话转储、日志流

**格式：** 每行一个 JSON 对象，换行分隔

```jsonl
{"type": "message", "timestamp": "2024-01-01T00:00:00Z", "content": "Hello"}
{"type": "tool", "timestamp": "2024-01-01T00:00:01Z", "name": "search", "args": {...}}
{"type": "end", "timestamp": "2024-01-01T00:00:02Z"}
```

### JSON

**用途：** 配置文件、会话索引

**格式：** 标准 JSON（支持 JSON5，允许注释和尾随逗号）

```json5
{
  gateway: {
    mode: "local",
    port: 18789,
  },
  channels: {
    telegram: {
      enabled: true,
    },
  },
}
```

## 数据清理策略

### 会话数据

- **存储格式：** 增量 JSONL 追加写入
- **清理机制：** 需要手动清理或通过磁盘预算管理
- **保留策略：** 取决于用户配置，默认不自动删除

### 媒体缓存

- **临时文件：** 存储在系统临时目录
- **持久缓存：** 存储在 `media/` 子目录
- **自动清理：** 部分清理规则，建议定期检查

### 日志文件

- **滚动机制：** 建议配置日志滚动
- **大小限制：** 可配置磁盘预算
- **自动轮转：** 根据大小或时间

## 迁移和兼容性

### 旧版目录

**目录名：** `~/.clawdbot`

**自动检测：** `src/config/paths.ts:73-86`

```typescript
const legacyDirs = legacyStateDirs(effectiveHomedir);
const existingLegacy = legacyDirs.find((dir) => {
  try {
    return fs.existsSync(dir);
  } catch {
    return false;
  }
});
if (existingLegacy) {
  return existingLegacy;  // 优先使用旧目录
}
```

### 迁移建议

```bash
# 备份旧数据
cp -r ~/.clawdbot ~/.clawdbot.backup

# 运行迁移工具
openclaw doctor --migrate

# 验证新目录
ls ~/.openclaw/
```

`★ Insight ─────────────────────────────────────`
1. **分层存储设计**：OpenClaw 采用状态目录、配置目录、临时目录的分层设计，便于多实例部署和数据隔离
2. **环境变量优先**：所有关键路径都支持通过环境变量覆盖，便于容器化部署和 CI/CD 集成
3. **JSONL 流式格式**：会话转储采用 JSONL 格式（每行一个 JSON），支持增量写入和流式处理，避免内存中累积大量数据
`─────────────────────────────────────────────────`
