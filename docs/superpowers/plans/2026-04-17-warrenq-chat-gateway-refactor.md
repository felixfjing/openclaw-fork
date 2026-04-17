# Warrenq Chat 页面 Gateway 协议改造方案

> 作者: 胡丹
> 日期: 2026-04-17
> 状态: 待实施

## 问题分析

当前 `warrenq-chat-page.ts` 自行实现了 WebSocket 协议，存在以下问题：

| 问题 | 现状 | 应改为 |
|------|------|--------|
| WebSocket URL | `ws://host/ws` | `ws://host:port`（与 HTTP 同源，切换协议） |
| 握手流程 | 自行拼 challenge->connect | 复用 `GatewayBrowserClient` |
| RPC ID | `req_${Date.now()}_${counter}` | UUID（`generateUUID()`） |
| 认证 | 无 auth/device identity | 支持 gateway token |
| 消息发送 | `chat.send` 缺 `deliver:false`、`idempotencyKey` | 与主应用一致 |
| 消息文本提取 | 自行解析 content 数组 | 复用 `extractText()` |
| 事件处理 | 只处理 delta/final/error | 增加 aborted 状态处理 |
| 控制台错误 | 大量 "Uncaught (in promise)" | 消除 |

## 改造方案：复用 GatewayBrowserClient

**核心思路**：不再自己管理 WebSocket，而是导入并使用 `ui/src/ui/gateway.ts` 中的 `GatewayBrowserClient`。

### 关键源码参考

| 文件 | 用途 |
|------|------|
| `ui/src/ui/gateway.ts` | GatewayBrowserClient 类，完整的 WS 连接/握手/RPC 管理 |
| `ui/src/ui/controllers/chat.ts` | Chat 控制器，chat.send/chat.history/chat.abort 调用方式 |
| `ui/src/ui/chat/message-extract.ts` | extractText()，从 content 数组提取纯文本 |
| `ui/src/ui/storage.ts` | deriveDefaultGatewayUrl()，默认 WS URL 推导逻辑 |
| `ui/src/ui/uuid.ts` | generateUUID() |

### Gateway 协议要点

1. **连接**: `new WebSocket(wsUrl)` 其中 `wsUrl = ws://host:port`
2. **握手**: 服务器发送 `connect.challenge` 事件 -> 客户端发送 `connect` RPC -> 服务器响应 `hello-ok`
3. **RPC**: `{type: "req", id: uuid, method, params}` -> `{type: "res", id, ok, payload, error}`
4. **事件**: `{type: "event", event, payload, seq}`
5. **Chat 方法**:
   - `chat.history` `{sessionKey, limit}` -> `{messages, thinkingLevel}`
   - `chat.send` `{sessionKey, message, deliver:false, idempotencyKey:uuid}`
   - `chat.abort` `{sessionKey, runId}`
6. **Chat 事件** (event: "chat"):
   - `delta`: 流式文本片段
   - `final`: 完整消息
   - `aborted`: 中止消息
   - `error`: 错误消息

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `ui/src/ui/views/warrenq-chat-page.ts` | **重写** | 移除自行实现的 WS 逻辑，改用 GatewayBrowserClient |
| `ui/src/ui/views/warrenq-chat.types.ts` | 修改 | 增加 ChatEventPayload 类型 |

## 改造步骤

### Step 1: 移除自定义 WebSocket 代码，导入 GatewayBrowserClient

移除的代码:
- `_ws`, `_reconnectAttempts`, `_reconnectTimer` 属性
- `_reqIdCounter`, `_pendingRpc`, `_handshakeDone` 属性
- `_rpc()`, `_connectWebSocket()`, `_disconnectWebSocket()` 方法
- `_scheduleReconnect()`, `_handleGatewayMessage()`, `_sendConnect()` 方法
- `_extractTextFromContent()` 方法
- `_rejectPendingRpc()` 方法

新增导入:
```typescript
import { GatewayBrowserClient, type GatewayEventFrame, type GatewayHelloOk } from "../gateway.ts";
import { extractText } from "../chat/message-extract.ts";
import { generateUUID } from "../uuid.ts";
```

### Step 2: 使用 GatewayBrowserClient 管理连接

新增属性:
```typescript
private _client: GatewayBrowserClient | null = null;
private _runId: string | null = null;
```

连接逻辑:
```typescript
private _connectGateway() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${proto}//${location.host}`;
  
  this._client = new GatewayBrowserClient({
    url,
    clientName: "openclaw-control-ui",
    clientVersion: "warrenq-chat",
    platform: "web",
    mode: "webchat",
    onHello: (hello) => this._onHello(hello),
    onEvent: (evt) => this._onEvent(evt),
    onClose: (info) => this._onClose(info),
  });
  this._client.start();
}
```

### Step 3: 实现 onHello / onEvent / onClose

```typescript
private _onHello(hello: GatewayHelloOk) {
  this._connected = true;
  this._loadSessions();
}

private _onEvent(evt: GatewayEventFrame) {
  if (evt.event === "chat") {
    this._handleChatEvent(evt.payload as ChatEventPayload);
  }
}

private _onClose(info: { code: number; reason: string }) {
  this._connected = false;
}
```

### Step 4: 改造 RPC 调用（移除 REST fallback）

所有数据操作通过 GatewayBrowserClient.request() 进行:
```typescript
// 会话列表
const res = await this._client.request("sessions.list", { ... });

// 聊天历史
const res = await this._client.request("chat.history", { sessionKey, limit: 200 });

// 发送消息
const runId = generateUUID();
await this._client.request("chat.send", {
  sessionKey,
  message: content,
  deliver: false,
  idempotencyKey: runId,
});
```

### Step 5: 改造聊天事件处理

使用 `extractText()` 提取文本，处理 4 种状态:
- delta: 追加流式文本
- final: 写入完整消息，清除流
- aborted: 保留已流式文本
- error: 显示错误，标记失败

### Step 6: 断开连接

```typescript
disconnectedCallback() {
  super.disconnectedCallback();
  this._client?.stop();
  this._client = null;
}
```

## 预期效果

- 消除控制台 "Uncaught (in promise)" 错误
- 与主应用共享完全相同的 Gateway 协议实现
- 自动获得 device auth、token 管理、重连退避等能力
- 代码量减少约 200 行

## 验证步骤

1. `pnpm check` - 无 import cycle、lint 错误
2. `pnpm --filter ui build` - 构建成功
3. Docker 重建后访问 `/plugins/gildata/warrenq-chat`
4. 控制台无 "Uncaught (in promise)" 错误
5. 页面正常渲染，WebSocket 连接成功
