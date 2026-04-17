# OpenClaw Gateway Protocol Complete Reference

## 概述

OpenClaw Gateway 是一个多平台的 AI 网关，通过 WebSocket 和 HTTP 提供统一的控制平面和节点传输。所有客户端（CLI、Web UI、macOS 应用、iOS/Android 节点、无头节点）都通过 WebSocket 连接，并在握手时声明其**角色**和**范围**。

## 协议版本

- **当前协议版本**: 3
- **协议版本定义**: `src/gateway/protocol/schema/protocol-schemas.ts`
- **协议生成命令**:
  - `pnpm protocol:gen` - 生成协议代码
  - `pnpm protocol:gen:swift` - 生成 Swift 客户端代码
  - `pnpm protocol:check` - 检查协议一致性

## 传输层

### WebSocket 传输

- **协议**: WebSocket，JSON 文本帧
- **端口**: 0（与 HTTP 复用同一端口）
- **帧格式**:
  ```json
  // 请求帧
  { "type": "req", "id": "...", "method": "...", "params": {...} }

  // 响应帧
  { "type": "res", "id": "...", "ok": true|false, "payload": {...}, "error": {...} }

  // 事件帧
  { "type": "event", "event": "...", "payload": {...}, "seq": 123, "stateVersion": {...} }
  ```

### HTTP 传输

支持 OpenAI 兼容的 HTTP API：
- `POST /v1/chat/completions` - 聊天完成
- `GET /v1/models` - 模型列表
- `POST /v1/embeddings` - 嵌入向量
- `POST /v1/responses` - 响应API
- `POST /tools/invoke` - 工具调用

## WebSocket 握手流程

### 1. 服务器挑战

Gateway → Client:

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "...",
    "ts": 1737264000000
  }
}
```

### 2. 客户端连接请求

Client → Gateway:

```json
{
  "type": "req",
  "id": "...",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": {
      "token": "..."
    },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "...",
      "signature": "...",
      "signedAt": 1737264000000,
      "nonce": "..."
    }
  }
}
```

### 3. 服务器响应

Gateway → Client:

```json
{
  "type": "res",
  "id": "...",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 3,
    "policy": {
      "tickIntervalMs": 15000
    }
  }
}
```

带有设备令牌时：

```json
{
  "auth": {
    "deviceToken": "...",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

## 角色 (Roles) 和范围 (Scopes)

### 角色类型

1. **operator** - 控制平面客户端（CLI/UI/自动化）
2. **node** - 能力主机（相机/屏幕/画布/系统运行）

### 操作员范围

- `operator.read` - 读取权限
- `operator.write` - 写入权限
- `operator.admin` - 管理员权限
- `operator.approvals` - 执行审批
- `operator.pairing` - 设备配对
- `operator.talk.secrets` - 语音唤醒/讲话机密

### 节点能力声明

```json
{
  "caps": ["camera", "canvas", "screen", "location", "voice"],
  "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
  "permissions": {
    "camera.capture": true,
    "screen.record": false
  }
}
```

## 设备身份和配对

### 设备身份

每个连接必须包含设备身份：
```json
{
  "device": {
    "id": "device_fingerprint",
    "publicKey": "...",
    "signature": "...",
    "signedAt": 1737264000000,
    "nonce": "..."
  }
}
```

### 设备配对流程

1. 节点发送配对请求
2. 操作员批准/拒绝配对
3. 网关生成设备令牌
4. 节点使用令牌重新连接

### 设备令牌

- 作用域限制在批准的角色和权限内
- 可以通过 `device.token.rotate` 旋转
- 可以通过 `device.token.revoke` 撤销

## 核心 RPC 方法

### 系统和身份

- `health` - 网关健康检查
- `status` - 网关状态摘要
- `gateway.identity.get` - 获取网关身份
- `system-presence` - 获取在线设备列表
- `system-event` - 添加系统事件
- `last-heartbeat` - 获取最新心跳
- `set-heartbeats` - 切换心跳处理

### 模型和使用

- `models.list` - 获取可用模型列表
- `usage.status` - 获取使用状态和配额
- `usage.cost` - 获取成本使用摘要
- `doctor.memory.status` - 向量内存状态
- `sessions.usage` - 会话使用摘要
- `sessions.usage.timeseries` - 使用时间序列
- `sessions.usage.logs` - 使用日志

### 渠道和登录

- `channels.status` - 渠道状态
- `channels.logout` - 渠道登出
- `web.login.start` - 开始Web登录
- `web.login.wait` - 等待登录完成
- `push.test` - 测试推送通知
- `voicewake.get/set` - 唤醒词管理

### 消息和日志

- `send` - 直接发送消息
- `logs.tail` - 获取日志

### 语音和TTS

- `talk.config` - 获取语音配置
- `talk.mode` - 设置语音模式
- `talk.speak` - 合成语音
- `tts.status/providers/enable/disable/setProvider/convert` - TTS相关方法

### 配置、更新和向导

- `secrets.reload/resolve` - 密钥管理
- `config.get/set/patch/apply/schema/schema.lookup` - 配置管理
- `update.run` - 运行更新
- `wizard.start/next/status/cancel` - 向导管理

### 会话控制

- `sessions.list/subscribe/unsubscribe` - 会话管理
- `sessions.messages.subscribe/unsubscribe` - 消息订阅
- `sessions.preview/resolve/create/send/steer/abort/patch/reset/delete/compact/get` - 会话操作
- `chat.history/chat.send/chat.abort/chat.inject` - 聊天操作

### 节点管理

- `node.pair.request/list/approve/reject/verify` - 节点配对
- `node.list/describe` - 节点信息
- `node.rename` - 重命名节点
- `node.invoke/result` - 节点调用
- `node.event` - 节点事件
- `node.canvas.capability.refresh` - 画布能力刷新
- `node.pending.pull/ack/enqueue/drain` - 待处理工作队列

### 执行审批

- `exec.approval.request/get/list/resolve/waitDecision` - 执行审批
- `exec.approvals.get/set` - 审批策略
- `exec.approvals.node.get/set` - 节点审批策略
- `plugin.approval.request/list/waitDecision/resolve` - 插件审批

### 技能和工具

- `commands.list` - 命令列表
- `skills.*` - 技能相关
- `tools.catalog/tools.effective` - 工具目录

## 事件系统

### 常见事件

- `chat` - 聊天更新
- `session.message/session.tool` - 会话消息和工具调用
- `sessions.changed` - 会话变更
- `presence` - 在线状态更新
- `tick` - 定时心跳
- `health` - 健康状态更新
- `heartbeat` - 心跳事件
- `cron` - 定时任务事件
- `shutdown` - 关机通知
- `node.pair.requested/resolved` - 节点配对生命周期
- `node.invoke.request` - 节点调用请求
- `device.pair.requested/resolved` - 设备配对生命周期
- `exec.approval.requested/resolved` - 执行审批生命周期
- `plugin.approval.requested/resolved` - 插件审批生命周期

## HTTP API 详细

### OpenAI 兼容 API

#### 认证

- 共享密钥认证: `Authorization: Bearer <token-or-password>`
- 信任代理认证: 通过配置的代理服务器注入身份头
- 开放认证: `gateway.auth.mode="none"`（仅限内部网络）

#### 安全边界

- HTTP 持有者认证视为完整的操作员访问
- 一旦通过认证，调用者被视为可信操作员
- 在循环/私有网络上使用，不要直接暴露到公共互联网

#### 路由行为

- `model: "openclaw"` → 默认代理
- `model: "openclaw/<agentId>"` → 特定代理
- `x-openclaw-model` → 覆盖后端模型
- `x-openclaw-session-key` → 完全会话控制

#### 请求示例

```bash
# 非流式
curl -sS http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "model": "openclaw/default",
    "messages": [{"role":"user","content":"hi"}]
  }'

# 流式
curl -N http://127.0.0.1:18789/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -d '{
    "model": "openclaw/research",
    "stream": true,
    "messages": [{"role":"user","content":"hi"}]
  }'
```

### 工具调用 API

#### 端点

`POST /tools/invoke`

#### 请求格式

```json
{
  "tool": "sessions_list",
  "action": "json",
  "args": {},
  "sessionKey": "main",
  "dryRun": false
}
```

#### 策略控制

工具可用性通过以下策略链过滤：
- `tools.profile` / `tools.byProvider.profile`
- `tools.allow` / `tools.byProvider.allow`
- `agents.<id>.tools.allow` / `agents.<id>.tools.byProvider.allow`
- 组策略
- 子代理策略

#### 默认拒绝列表

- `exec` - 命令执行
- `spawn` - 进程创建
- `shell` - Shell命令
- `fs_write` - 文件写入
- `fs_delete` - 文件删除
- `fs_move` - 文件移动
- `apply_patch` - 补丁应用
- `sessions_spawn` - 会话生成
- `sessions_send` - 跨会话消息
- `cron` - 定时任务
- `gateway` - 网关控制
- `nodes` - 节点命令
- `whatsapp_login` - WhatsApp登录

#### 响应

- `200` → `{ ok: true, result }`
- `400` → 无效请求
- `401` → 未授权
- `429` → 频率限制
- `404` → 工具不可用
- `500` → 服务器错误

#### 示例

```bash
curl -sS http://127.0.0.1:18789/tools/invoke \
  -H 'Authorization: Bearer secret' \
  -H 'Content-Type: application/json' \
  -d '{
    "tool": "sessions_list",
    "action": "json",
    "args": {}
  }'
```

## 执行审批系统

### 审批流程

1. 当执行请求需要审批时，网关广播 `exec.approval.requested`
2. 操作员客户端调用 `exec.approval.resolve`（需要 `operator.approvals` 范围）
3. 对于 `host=node`，`exec.approval.request` 必须包含 `systemRunPlan`
4. 批准后，转发的 `node.invoke system.run` 调用使用该规范化的 `systemRunPlan`

### 安全检查

- 在 prepare 和最终批准之间，如果调用者修改了 `command`、`rawCommand`、`cwd`、`agentId` 或 `sessionKey`，网关会拒绝运行

## 错误码

### 设备认证错误

| 错误信息 | 代码 | 原因 | 含义 |
|---------|------|------|------|
| device nonce required | DEVICE_AUTH_NONCE_REQUIRED | device-nonce-missing | 客户端缺少 device.nonce |
| device nonce mismatch | DEVICE_AUTH_NONCE_MISMATCH | device-nonce-mismatch | 客户端使用过期的/错误的 nonce |
| device signature invalid | DEVICE_AUTH_SIGNATURE_INVALID | device-signature | 签名 payload 不匹配 v2 payload |
| device signature expired | DEVICE_AUTH_SIGNATURE_EXPIRED | device-signature-stale | 签名时间戳超出允许偏差 |
| device identity mismatch | DEVICE_AUTH_DEVICE_ID_MISMATCH | device-id-mismatch | device.id 不匹配公钥指纹 |
| device public key invalid | DEVICE_AUTH_PUBLIC_KEY_INVALID | device-public-key | 公钥格式/标准化失败 |

### 一般错误

- `NOT_LINKED` - 未连接
- `NOT_PAIRED` - 未配对
- `AGENT_TIMEOUT` - 代理超时
- `INVALID_REQUEST` - 无效请求
- `APPROVAL_NOT_FOUND` - 找不到审批
- `UNAVAILABLE` - 不可用

## 内存管理

### 会话压缩

- 自动或手动会话压缩以管理转录大小
- 压缩检查点包括：时间戳、令牌计数、摘要、引用信息
- 支持分支和恢复功能

### 向量内存

- `doctor.memory.status` 返回向量内存/嵌入的可用性
- 需要为活动默认代理工作空间配置

## 安全注意事项

### TLS 和固定

- 支持 WebSocket 的 TLS 连接
- 客户端可以选择固定网关证书指纹

### 网关身份

- 网关设备身份用于中继和配对流程
- 在 `gateway.identity.get` 中返回

### 权限最小化

- 设备令牌严格限制在批准的角色和权限内
- 非管理员调用者只能操作自己的设备条目
- 执行审批提供额外的安全层

## 代码结构

### 核心文件

- `src/gateway/protocol/schema.ts` - 协议模式导出
- `src/gateway/protocol/schema/protocol-schemas.ts` - 协议模式定义
- `src/gateway/protocol/schema/frames.ts` - 帧结构定义
- `src/gateway/protocol/schema/types.ts` - 类型导出
- `src/gateway/protocol/schema/snapshot.ts` - 快照和存在性定义

### 模式文件（21个）

- `agent.ts` - 代理相关模式
- `agents-models-skills.ts` - 代理、模型、技能模式
- `channels.ts` - 渠道模式
- `commands.ts` - 命令模式
- `config.ts` - 配置模式
- `cron.ts` - 定时任务模式
- `devices.ts` - 设备模式
- `exec-approvals.ts` - 执行审批模式
- `frames.ts` - 帧模式
- `logs-chat.ts` - 日志和聊天模式
- `nodes.ts` - 节点模式
- `plugin-approvals.ts` - 插件审批模式
- `sessions.ts` - 会话模式
- `secrets.ts` - 密钥模式
- `snapshot.ts` - 快照模式
- `types.ts` - 类型模式
- `wizard.ts` - 向导模式

### 工具方法

位于 `src/gateway/server-methods/` 目录下：
- 系统和身份方法
- 模型和使用方法
- 渠道和登录方法
- 消息和日志方法
- 语音和TTS方法
- 配置、更新和向导方法
- 会话控制方法
- 节点管理方法
- 执行审批方法
- 技能/工具方法

## 客户端实现指南

### 1. 连接建立

1. 等待服务器发送 `connect.challenge`
2. 签名包含服务器 nonce 的 payload
3. 发送 `connect` 请求，包含签名后的设备信息
4. 处理 `hello-ok` 响应，保存 deviceToken

### 2. 协议帧处理

```javascript
// 发送请求
const request = {
  type: 'req',
  id: generateId(),
  method: 'sessions.list',
  params: {}
};

// 处理响应
ws.on('message', (data) => {
  const frame = JSON.parse(data);
  if (frame.type === 'res') {
    if (frame.ok) {
      // 处理成功响应
    } else {
      // 处理错误
    }
  } else if (frame.type === 'event') {
    // 处理事件
  }
});
```

### 3. 错误处理

- `AUTH_TOKEN_MISMATCH`：尝试使用缓存的 deviceToken 重试
- 设备认证错误：检查签名流程是否正确

### 4. 定时心跳

- 保持活跃连接定期发送 ping
- 监听 `tick` 事件

## 协议扩展点

### 插件注册

- 网关 RPC 方法可以请求自己的操作员范围
- 保留的核心前缀始终解析为 `operator.admin`

### 渠道集成

- 插件可以注册新的渠道和消息处理方法
- 通过 `channels.status` 获取渠道状态

### 工具提供者

- 技能可以注册自己的工具
- 通过 `tools.catalog` 获取工具目录
- 支持提供者感知的工具命名

## 性能考虑

### 流控制

- 政策包含 `maxPayload` 和 `maxBufferedBytes`
- 使用 `seq` 字段跟踪事件顺序
- `stateVersion` 用于状态同步

### 缓存策略

- 会话使用缓存优化
- 快照信息定期更新
- 设备令牌持久化以减少握手开销

## 监控和调试

### 日志

- `logs.tail` 获取文件日志尾
- 支持游标和限制控制
- 最大字节限制

### 指标

- 心跳事件提供连接健康状态
- 会话使用摘要和日志
- 执行审批生命周期跟踪

### 健康检查

- `health` 返回缓存或新探查的健康快照
- 仅向有范围限制的操作员客户端显示敏感字段

## 最佳实践

### 安全

- 始终使用 TLS（WebSocket）
- 不要在公共互联网上暴露 HTTP 端点
- 定期轮换设备令牌
- 限制范围权限

### 性能

- 合理使用事件订阅避免过度通信
- 使用 idempotency keys 处理副作用
- 定期清理不需要的会话

### 可靠性

- 实现适当的重试逻辑
- 处理连接断开和重连
- 监控审批超时和失败

---

## 附录：完整的 Schema 列表

所有协议模式都在 `src/gateway/protocol/schema/protocol-schemas.ts` 中定义：

### 基础帧
- `ConnectParams` - 连接参数
- `HelloOk` - 连接成功响应
- `RequestFrame` - 请求帧
- `ResponseFrame` - 响应帧
- `EventFrame` - 事件帧
- `GatewayFrame` - 通用帧（联合类型）
- `ErrorShape` - 错误形状
- `StateVersion` - 状态版本
- `Snapshot` - 系统快照
- `PresenceEntry` - 在线条目

### 代理相关
- `AgentEvent` - 代理事件
- `AgentIdentityParams/Result` - 代理身份
- `AgentWaitParams` - 等待代理
- `WakeParams` - 唤醒参数
- `MessageActionParams` - 消息操作
- `SendParams` - 发送参数
- `PollParams` - 轮询参数

### 节点相关
- `NodePair*Params` - 节点配对参数
- `NodeRenameParams` - 节点重命名
- `NodeListParams` - 节点列表
- `NodePendingAckParams` - 待处理确认
- `NodeDescribeParams` - 节点描述
- `NodeInvokeParams/Result` - 节点调用
- `NodeEventParams` - 节点事件
- `NodePending*Params` - 待处理工作

### 设备相关
- `DevicePair*Params` - 设备配对参数
- `DeviceToken*Params` - 设备令牌参数
- `DevicePair*Event` - 设备配对事件

### 会话相关
- `Sessions*Params` - 会话各种操作参数
- `SessionCompaction*` - 会话压缩相关
- `SessionsUsageParams` - 使用统计

### 配置相关
- `ConfigGet/Set/Patch/ApplyParams` - 配置操作
- `ConfigSchemaParams/LookupParams` - 配置模式
- `UpdateRunParams` - 更新运行

### 工具相关
- `ToolsCatalogParams/Result` - 工具目录
- `ToolsEffectiveParams/Result` - 有效工具
- `Skills*Params/Result` - 技能操作
- `CommandsListParams/Result` - 命令列表

### 定时任务
- `CronJob` - 定时任务作业
- `Cron*Params` - 定时任务操作参数

### 执行审批
- `ExecApproval*Params` - 执行审批参数
- `ExecApprovals*Params` - 审批策略
- `PluginApproval*Params` - 插件审批

### 语音和TTS
- `Talk*Params` - 语音操作
- `PushTestParams/Result` - 推送测试

### 渠道
- `ChannelsStatus/LogoutParams` - 渠道操作
- `WebLogin*Params` - Web登录

### 密钥
- `Secrets*Params` - 密钥操作

### 聊天
- `Chat*Params` - 聊天操作
- `ChatEvent` - 聊天事件

### 向导
- `Wizard*Params/Step/Result` - 向导操作

### 日志
- `LogsTailParams/Result` - 日志操作

### 系统事件
- `TickEvent` - 定时事件
- `ShutdownEvent` - 关机事件

这个完整的协议参考涵盖了 OpenClaw Gateway 的所有方面，包括 WebSocket 和 HTTP API、认证系统、角色权限、设备配对、会话管理、节点控制、执行审批等核心功能。