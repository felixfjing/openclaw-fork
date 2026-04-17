# OpenClaw Chat WebSocket 协议

本文档描述了 OpenClaw 网关中对话功能的 WebSocket 协议规范，包括请求方法、响应格式和事件推送。

## 目录

- [协议基础](#协议基础)
- [请求方法](#请求方法)
  - [chat.send - 发送聊天消息](#chatsend---发送聊天消息)
  - [chat.abort - 中止聊天](#chatabort---中止聊天)
  - [chat.history - 获取聊天历史](#chathistory---获取聊天历史)
- [WebSocket 事件](#websocket-事件)
  - [chat - 聊天流事件](#chat---聊天流事件)
  - [chat.side_result - 侧边结果事件](#chatside_result---侧边结果事件)
  - [session.message - 会话消息事件](#sessionmessage---会话消息事件)
- [完整调用链路](#完整调用链路)

---

## 协议基础

### WebSocket 帧格式

所有 WebSocket 通信都使用 JSON 格式的帧，分为请求帧、响应帧和事件帧。

#### 请求帧 (Request Frame)

```json
{
  "type": "req",           // 固定值 "req"
  "id": "uuid-string",     // 请求ID，用于关联响应
  "method": "string",      // 方法名称
  "params": {}             // 方法参数，结构取决于方法
}
```

#### 响应帧 (Response Frame)

```json
{
  "type": "res",           // 固定值 "res"
  "id": "uuid-string",     // 对应的请求ID
  "ok": boolean,           // 是否成功
  "payload": {},           // 响应数据 (成功时)
  "error": {               // 错误信息 (失败时)
    "code": "string",      // 错误代码
    "message": "string",   // 错误消息
    "details": {},         // 详细错误信息
    "retryable": boolean,  // 是否可重试
    "retryAfterMs": number // 建议重试延迟(毫秒)
  }
}
```

#### 事件帧 (Event Frame)

```json
{
  "type": "event",         // 固定值 "event"
  "event": "string",       // 事件名称
  "payload": {},           // 事件数据
  "seq": number,           // 事件序列号
  "stateVersion": {        // 状态版本号
    "presence": number,
    "health": number
  }
}
```

---

## 请求方法

### 完整方法列表

以下是 OpenClaw 网关支持的所有 WebSocket 请求方法：

| 方法名 | 说明 |
|--------|------|
| `health` | 健康检查 |
| `doctor.memory.status` | 获取记忆状态 |
| `doctor.memory.dreamDiary` | 获取梦境日记 |
| `doctor.memory.backfillDreamDiary` | 回填梦境日记 |
| `doctor.memory.resetDreamDiary` | 重置梦境日记 |
| `doctor.memory.resetGroundedShortTerm` | 重置短期记忆 |
| `doctor.memory.repairDreamingArtifacts` | 修复梦境工件 |
| `doctor.memory.dedupeDreamDiary` | 去重梦境日记 |
| `logs.tail` | 获取日志尾部 |
| `channels.status` | 获取通道状态 |
| `channels.logout` | 退出通道登录 |
| `status` | 获取系统状态 |
| `usage.status` | 获取使用状态 |
| `usage.cost` | 获取使用成本 |
| `tts.status` | 获取 TTS 状态 |
| `tts.providers` | 获取 TTS 提供商 |
| `tts.enable` | 启用 TTS |
| `tts.disable` | 禁用 TTS |
| `tts.convert` | 转换 TTS |
| `tts.setProvider` | 设置 TTS 提供商 |
| `config.get` | 获取配置 |
| `config.set` | 设置配置 |
| `config.apply` | 应用配置 |
| `config.patch` | 补丁配置 |
| `config.schema` | 获取配置模式 |
| `config.schema.lookup` | 查找配置模式 |
| `exec.approvals.get` | 获取执行批准 |
| `exec.approvals.set` | 设置执行批准 |
| `exec.approvals.node.get` | 获取节点执行批准 |
| `exec.approvals.node.set` | 设置节点执行批准 |
| `exec.approval.get` | 获取单个执行批准 |
| `exec.approval.list` | 列出执行批准 |
| `exec.approval.request` | 请求执行批准 |
| `exec.approval.waitDecision` | 等待批准决定 |
| `exec.approval.resolve` | 解决执行批准 |
| `plugin.approval.list` | 列出插件批准 |
| `plugin.approval.request` | 请求插件批准 |
| `plugin.approval.waitDecision` | 等待插件批准决定 |
| `plugin.approval.resolve` | 解决插件批准 |
| `wizard.start` | 开始向导 |
| `wizard.next` | 向导下一步 |
| `wizard.cancel` | 取消向导 |
| `wizard.status` | 向导状态 |
| `talk.config` | 对话配置 |
| `talk.speak` | 对话说话 |
| `talk.mode` | 对话模式 |
| `commands.list` | 列出命令 |
| `models.list` | 列出模型 |
| `models.authStatus` | 模型认证状态 |
| `tools.catalog` | 工具目录 |
| `tools.effective` | 有效工具 |
| `agents.list` | 列出代理 |
| `agents.create` | 创建代理 |
| `agents.update` | 更新代理 |
| `agents.delete` | 删除代理 |
| `agents.files.list` | 列出代理文件 |
| `agents.files.get` | 获取代理文件 |
| `agents.files.set` | 设置代理文件 |
| `skills.status` | 技能状态 |
| `skills.search` | 搜索技能 |
| `skills.detail` | 技能详情 |
| `skills.bins` | 技能存储桶 |
| `skills.install` | 安装技能 |
| `skills.update` | 更新技能 |
| `update.run` | 运行更新 |
| `voicewake.get` | 获取语音唤醒 |
| `voicewake.set` | 设置语音唤醒 |
| `secrets.reload` | 重载密钥 |
| `secrets.resolve` | 解析密钥 |
| `sessions.list` | 列出会话 |
| `sessions.subscribe` | 订阅会话 |
| `sessions.unsubscribe` | 取消订阅会话 |
| `sessions.messages.subscribe` | 订阅会话消息 |
| `sessions.messages.unsubscribe` | 取消订阅会话消息 |
| `sessions.preview` | 预览会话 |
| `sessions.compaction.list` | 列出压缩 |
| `sessions.compaction.get` | 获取压缩 |
| `sessions.compaction.branch` | 分支压缩 |
| `sessions.compaction.restore` | 恢复压缩 |
| `sessions.create` | 创建会话 |
| `sessions.send` | 发送会话消息 |
| `sessions.abort` | 中止会话 |
| `sessions.patch` | 补丁会话 |
| `sessions.reset` | 重置会话 |
| `sessions.delete` | 删除会话 |
| `sessions.compact` | 压缩会话 |
| `last-heartbeat` | 最后心跳 |
| `set-heartbeats` | 设置心跳 |
| `wake` | 唤醒 |
| `node.pair.request` | 请求节点配对 |
| `node.pair.list` | 列出节点配对 |
| `node.pair.approve` | 批准节点配对 |
| `node.pair.reject` | 拒绝节点配对 |
| `node.pair.verify` | 验证节点配对 |
| `device.pair.list` | 列出设备配对 |
| `device.pair.approve` | 批准设备配对 |
| `device.pair.reject` | 拒绝设备配对 |
| `device.pair.remove` | 移除设备配对 |
| `device.token.rotate` | 轮换设备令牌 |
| `device.token.revoke` | 撤销设备令牌 |
| `node.rename` | 重命名节点 |
| `node.list` | 列出节点 |
| `node.describe` | 描述节点 |
| `node.pending.drain` | 清空节点待处理 |
| `node.pending.enqueue` | 入队节点待处理 |
| `node.invoke` | 调用节点 |
| `node.pending.pull` | 拉取节点待处理 |
| `node.pending.ack` | 确认节点待处理 |
| `node.invoke.result` | 节点调用结果 |
| `node.event` | 节点事件 |
| `node.canvas.capability.refresh` | 刷新画布能力 |
| `cron.list` | 列出定时任务 |
| `cron.status` | 定时任务状态 |
| `cron.add` | 添加定时任务 |
| `cron.update` | 更新定时任务 |
| `cron.remove` | 移除定时任务 |
| `cron.run` | 运行定时任务 |
| `cron.runs` | 定时任务运行 |
| `gateway.identity.get` | 获取网关身份 |
| `system-presence` | 系统存在 |
| `system-event` | 系统事件 |
| `message.action` | 消息操作 |
| `send` | 发送消息 |
| `agent` | 代理操作 |
| `agent.identity.get` | 获取代理身份 |
| `agent.wait` | 等待代理 |
| `chat.history` | 获取聊天历史 |
| `chat.abort` | 中止聊天 |
| `chat.send` | 发送聊天消息 |

---

### chat.send - 发送聊天消息

发送用户消息到指定会话，开始或继续对话。

#### 请求参数

```typescript
{
  sessionKey: string;              // 必填：会话标识符
  message: string;                 // 必填：消息内容（纯文本）
  thinking?: string;               // 可选：思考级别 ("off" | "low" | "medium" | "high")
  deliver?: boolean;               // 可选：是否投递到外部通道，默认 false
  originatingChannel?: string;     // 可选：来源通道标识
  originatingTo?: string;          // 可选：目标接收者
  originatingAccountId?: string;   // 可选：来源账户ID
  originatingThreadId?: string;    // 可选：来源线程ID
  attachments?: Array<{            // 可选：附件数组
    type: string;                  // 附件类型，通常为 "image"
    mimeType: string;              // MIME 类型，如 "image/png"
    content: string;               // Base64 编码的附件内容
  }>;
  timeoutMs?: number;              // 可选：超时时间（毫秒），最小值为 0
  systemInputProvenance?: {        // 可选：系统输入来源信息
    type: string;
    channel?: string;
    to?: string;
    accountId?: string;
    threadId?: string;
  };
  systemProvenanceReceipt?: string;// 可选：系统来源收据
  idempotencyKey: string;          // 必填：幂等键，用于防止重复发送
}
```

#### 响应参数

```typescript
{
  status: "started" | "error";     // 请求状态
  runId?: string;                  // 运行ID（成功时返回）
  error?: string;                  // 错误消息（失败时返回）
}
```

#### 示例

**请求：**
```json
{
  "type": "req",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "Hello, how are you?",
    "deliver": false,
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440001",
    "attachments": [
      {
        "type": "image",
        "mimeType": "image/png",
        "content": "iVBORw0KGgoAAAANS..."
      }
    ]
  }
}
```

**成功响应：**
```json
{
  "type": "res",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ok": true,
  "payload": {
    "status": "started",
    "runId": "run-1234567890"
  }
}
```

**失败响应：**
```json
{
  "type": "res",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "ok": false,
  "error": {
    "code": "INVALID_SESSION",
    "message": "Session not found"
  }
}
```

---

### chat.abort - 中止聊天

中止当前正在进行的聊天会话或指定的运行。

#### 请求参数

```typescript
{
  sessionKey: string;      // 必填：会话标识符
  runId?: string;         // 可选：要中止的运行ID，不指定则中止当前运行的会话
}
```

#### 响应参数

```typescript
{
  ok: boolean;            // 是否成功中止
}
```

#### 示例

**请求：**
```json
{
  "type": "req",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "method": "chat.abort",
  "params": {
    "sessionKey": "main",
    "runId": "run-1234567890"
  }
}
```

**成功响应：**
```json
{
  "type": "res",
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "ok": true,
  "payload": {
    "ok": true
  }
}
```

---

### chat.history - 获取聊天历史

获取指定会话的历史消息记录。

#### 请求参数

```typescript
{
  sessionKey: string;      // 必填：会话标识符
  limit?: number;          // 可选：返回消息数量限制 (1-1000)，默认 200
  maxChars?: number;       // 可选：返回字符数限制 (1-500000)
}
```

#### 响应参数

```typescript
{
  messages: Array<{        // 消息数组
    role: string;          // 消息角色 ("user" | "assistant" | "system" | "tool" | "toolresult")
    content?: string | Array<{  // 消息内容
      type: string;        // 内容块类型 ("text" | "image" | "tool_call" | "tool_result")
      text?: string;       // 文本内容
      source?: {           // 图片源信息（type 为 "image" 时）
        type: string;      // 源类型，如 "base64"
        media_type: string; // 媒体类型
        data: string;      // Base64 数据
      };
      // ... 其他字段取决于 type
    }>;
    text?: string;         // 简化文本字段（向后兼容）
    timestamp?: number;    // 时间戳
    usage?: {              // 使用统计（assistant 消息）
      input?: number;
      output?: number;
      totalTokens?: number;
      inputTokens?: number;
      outputTokens?: number;
      cacheRead?: number;
      cacheWrite?: number;
      cost?: { total?: number; };  // 成本信息
    };
    toolName?: string;     // 工具名称
    toolCallId?: string;   // 工具调用ID
    idempotencyKey?: string; // 幂等键
    // ... 其他字段
  }>;
  thinkingLevel?: string;  // 可选：思考级别
}
```

#### 示例

**请求：**
```json
{
  "type": "req",
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "method": "chat.history",
  "params": {
    "sessionKey": "main",
    "limit": 50
  }
}
```

**成功响应：**
```json
{
  "type": "res",
  "id": "550e8400-e29b-41d4-a716-446655440003",
  "ok": true,
  "payload": {
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "Hello!" }
        ],
        "timestamp": 1715424000000
      },
      {
        "role": "assistant",
        "content": [
          { "type": "text", "text": "Hi! How can I help you?" }
        ],
        "timestamp": 1715424010000,
        "usage": {
          "inputTokens": 10,
          "outputTokens": 8,
          "totalTokens": 18
        }
      }
    ],
    "thinkingLevel": "medium"
  }
}
```

---

## WebSocket 事件

### chat - 聊天流事件

在对话过程中推送，包含消息流、完成状态、错误等信息。

#### 事件参数

```typescript
{
  runId: string;                    // 运行ID
  sessionKey: string;               // 会话标识符
  seq: number;                      // 事件序列号
  state: "delta" | "final" | "aborted" | "error";  // 运行状态
  message?: {                       // 消息内容（state 为 "delta" 或 "final" 时）
    role: string;                   // 消息角色
    content?: string | Array<ContentBlock>;   // 消息内容
    text?: string;                  // 简化文本字段（向后兼容）
    timestamp?: number;              // 时间戳
    usage?: UsageStats;             // 使用统计（assistant 消息）
    toolName?: string;              // 工具名称
    toolCallId?: string;            // 工具调用ID
    idempotencyKey?: string;        // 幂等键
    metadata?: Record<string, unknown>; // 元数据
  };
  errorMessage?: string;            // 错误消息（state 为 "error" 时）
  errorKind?: ErrorKind;            // 错误类型（state 为 "error" 时）
  usage?: UsageStats;               // 使用统计
  stopReason?: StopReason;          // 停止原因（state 为 "final" 时）
  seq?: number;                    // 事件序列号（已弃用，保留用于兼容）
  thinkingLevel?: string;           // 思考级别（已弃用，保留用于兼容）
}
```

#### ContentBlock 内容块类型

消息内容 `content` 字段是一个数组，包含以下类型的内容块：

```typescript
type ContentBlock = 
  | TextContentBlock      // 文本内容
  | ThinkingContentBlock  // 思考/推理内容
  | ImageContentBlock     // 图片内容
  | ToolCallContentBlock  // 工具调用
  | ToolResultContentBlock // 工具结果
  | UnknownContentBlock;  // 其他未知类型
```

**TextContentBlock（文本内容）**
```typescript
{
  type: "text";
  text: string;     // 文本内容
}
```

**ThinkingContentBlock（思考内容）**
```typescript
{
  type: "thinking";
  thinking: string;  // 思考/推理内容
}
```

**ImageContentBlock（图片内容）**
```typescript
{
  type: "image";
  source?: {        // 图片源信息
    type: "base64"; // 数据类型
    media_type: string; // 媒体类型，如 "image/png"
    data: string;    // Base64 数据
  };
}
```

**ToolCallContentBlock（工具调用）**
```typescript
{
  type: "tool_call" | "toolcall";  // 工具调用类型
  name: string;                     // 工具名称
  input: Record<string, unknown>;   // 工具调用参数
}
```

**ToolResultContentBlock（工具结果）**
```typescript
{
  type: "tool_result" | "toolresult"; // 工具结果类型
  result: unknown;                    // 工具执行结果
}
```

#### UsageStats 使用统计

```typescript
{
  input?: number;        // 输入 token 数量
  output?: number;       // 输出 token 数量
  totalTokens?: number;  // 总 token 数量
  inputTokens?: number;  // 输入 token 数量（别名）
  outputTokens?: number; // 输出 token 数量（别名）
  cacheRead?: number;    // 缓存读取 token 数量
  cacheWrite?: number;   // 缓存写入 token 数量
  cost?: {               // 成本信息
    total?: number;      // 总成本
    input?: number;      // 输入成本
    output?: number;     // 输出成本
  };
}
```

#### ErrorKind 错误类型

```typescript
type ErrorKind = 
  | "refusal"           // 拒绝回答
  | "timeout"           // 超时
  | "rate_limit"        // 速率限制
  | "context_length"    // 上下文长度超限
  | "unknown"           // 未知错误
```

#### StopReason 停止原因

```typescript
type StopReason = 
  | "end_turn"          // 正常结束
  | "max_tokens"        // 达到最大 token 限制
  | "cancelled"         // 被取消
  | "error"            // 发生错误
```

#### 状态说明

| 状态 | 说明 |
|------|------|
| `delta` | 增量更新，包含部分消息内容。message.content 可能包含完整的消息快照 |
| `final` | 对话完成，包含最终消息和统计信息 |
| `aborted` | 对话被中止，通常由用户触发 |
| `error` | 对话发生错误，包含错误信息 |

#### 状态说明

| 状态 | 说明 |
|------|------|
| `delta` | 增量更新，包含部分消息内容 |
| `final` | 对话完成，包含最终消息 |
| `aborted` | 对话被中止 |
| `error` | 对话发生错误 |

#### 示例

**增量更新事件（文本流）：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 1,
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "Hello! I" }
      ]
    }
  },
  "seq": 100
}
```

**增量更新事件（包含思考）：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 2,
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "Hello! " },
        { 
          "type": "thinking", 
          "thinking": "The user greeted me. I should respond politely and ask how I can help them." 
        }
      ]
    }
  },
  "seq": 101
}
```

**增量更新事件（工具调用）：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 3,
    "state": "delta",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "Let me check the weather for you.\n" },
        { 
          "type": "tool_call",
          "name": "getWeather",
          "input": { "location": "New York" }
        }
      ]
    }
  },
  "seq": 102
}
```

**完成事件：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 5,
    "state": "final",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "text", "text": "Hello! I'm doing well, thank you for asking!" }
      ],
      "usage": {
        "inputTokens": 15,
        "outputTokens": 12,
        "totalTokens": 27,
        "cacheRead": 5,
        "cost": {
          "total": 0.0012
        }
      },
      "idempotencyKey": "abc123"
    },
    "stopReason": "end_turn"
  },
  "seq": 104
}
```

**工具结果事件：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 6,
    "state": "final",
    "message": {
      "role": "assistant",
      "content": [
        { "type": "tool_result", "result": { "temperature": 25, "condition": "sunny" } }
      ],
      "toolName": "getWeather",
      "toolCallId": "call_abc123"
    }
  },
  "seq": 105
}
```

**中止事件：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 3,
    "state": "aborted"
  },
  "seq": 103
}
```

**错误事件：**
```json
{
  "type": "event",
  "event": "chat",
  "payload": {
    "runId": "run-1234567890",
    "sessionKey": "main",
    "seq": 2,
    "state": "error",
    "errorMessage": "Rate limit exceeded",
    "errorKind": "rate_limit",
    "stopReason": "error"
  },
  "seq": 101
}
```

---

### chat.side_result - 侧边结果事件

用于推送 BTW (By The Way) 类型的侧边结果，这些结果不保存在聊天历史中。

#### 事件参数

```typescript
{
  kind: "btw";                    // 固定值 "btw"
  runId: string;                  // 关联的运行ID
  sessionKey: string;             // 会话标识符
  question: string;               // 原始问题
  text: string;                   // 回答文本（Markdown 格式）
  isError?: boolean;              // 是否为错误结果
  ts: number;                     // 时间戳
  seq?: number;                   // 序列号
}
```

#### 示例

```json
{
  "type": "event",
  "event": "chat.side_result",
  "payload": {
    "kind": "btw",
    "runId": "run-1234567890",
    "sessionKey": "main",
    "question": "What's the weather?",
    "text": "**Sunny**, 25°C\n\nPerfect day for a walk!",
    "isError": false,
    "ts": 1715424020000,
    "seq": 1
  },
  "seq": 105
}
```

---

### session.message - 会话消息事件

当会话中有新消息（来自其他客户端或外部源）时推送。

#### 事件参数

```typescript
{
  sessionKey: string;             // 会话标识符
  // ... 消息内容，结构与 chat.history 中的 message 相同
}
```

#### 示例

```json
{
  "type": "event",
  "event": "session.message",
  "payload": {
    "sessionKey": "main",
    "role": "user",
    "content": [
      { "type": "text", "text": "A message from another client" }
    ],
    "timestamp": 1715424030000
  },
  "seq": 106
}
```

---

## 完整调用链路

### 发送消息流程

```
用户输入
  ↓
chat.ts (UI)
  ├─ renderChat()
  │   └─ onSend()
  ↓
app-chat.ts (控制器)
  ├─ handleSendChat()
  │   ├─ 处理本地命令 (/stop, /reset, /clear, /focus 等)
  │   ├─ 处理 BTW 命令 (/btw)
  │   └─ sendChatMessageNow()
  │       └─ sendChatMessage()
  ↓
controllers/chat.ts
  ├─ sendChatMessage()
  │   └─ requestChatSend()
  │       └─ client.request("chat.send", {...})
  ↓
gateway.ts (WebSocket 客户端)
  └─ request()
      ├─ 构建 RequestFrame
      └─ WebSocket.send()
  ↓
服务器端处理
  ↓
WebSocket 推送事件
  ├─ chat (delta/final/aborted/error)
  └─ chat.side_result
```

### 接收事件流程

```
WebSocket 消息
  ↓
gateway.ts
  └─ handleMessage()
      └─ GatewayEventFrame
  ↓
app-gateway.ts
  └─ handleGatewayEvent()
      └─ handleChatGatewayEvent()
  ↓
controllers/chat.ts
  └─ handleChatEvent()
      ├─ delta: 更新 stream
      ├─ final: 添加消息到历史，清理状态
      ├─ aborted: 添加中止消息，清理状态
      └─ error: 设置错误信息，清理状态
  ↓
chat.ts (UI)
  └─ renderChat()
      └─ 更新 UI
```

### 消息状态机

```
         sendChatMessage()
               ↓
           [sending] ←────┐
               ↓          │
        [awaiting response] │
               ↓          │
      [chat event: delta]  │ (接收流式数据)
               ↓          │
        [streaming text]   │
               ↓          │
     [chat event: final]   │ (完成)
               │          │
               └──────────┘
               ↓
          [completed]
          (清理状态)

     [chat event: aborted] (中止)
          或
     [chat event: error] (错误)
               ↓
          [清理状态]
```

---

## 注意事项

1. **幂等性**: `chat.send` 请求必须包含 `idempotencyKey`，服务器会检查该键值，如果已存在则返回已处理的 runId，避免重复发送。

2. **流式响应**: 对话响应通过 `chat` 事件以流式方式推送，客户端需要处理多个 `delta` 状态事件来构建完整响应。

3. **序列号**: 所有事件都包含 `seq` 序列号，客户端可以通过检测序列号跳过来发现消息丢失。

4. **状态清理**: 当收到 `final`、`aborted` 或 `error` 状态的 `chat` 事件后，客户端应清理相关的运行状态（如 `chatRunId`、`chatStream` 等）。

5. **附件处理**: 附件数据以 Base64 编码形式传输，客户端需要将 Data URL 转换为 Base64 格式后再发送。

6. **NO_REPLY 消息**: 服务器可能返回内容为 `"NO_REPLY"` 的消息，客户端应过滤掉这些消息不显示。

7. **工具调用**: 当 AI 使用工具时，会发送 `tool_call` 类型的 content 块，后续会收到 `tool_result` 类型的消息包含工具执行结果。

8. **并发控制**: 客户端应维护 `chatRunId` 来跟踪当前运行，确保不会同时处理多个运行的响应。

---

## 相关文件

- `ui/src/ui/views/chat.ts` - 聊天 UI 组件
- `ui/src/ui/app-chat.ts` - 聊天应用逻辑
- `ui/src/ui/controllers/chat.ts` - 聊天控制器
- `ui/src/ui/gateway.ts` - WebSocket 客户端
- `ui/src/ui/app-gateway.ts` - 网关事件处理
- `src/gateway/server-methods/chat.ts` - 服务器端聊天方法
- `src/gateway/protocol/schema/logs-chat.ts` - 协议定义
- `src/gateway/protocol/schema/frames.ts` - 帧格式定义
