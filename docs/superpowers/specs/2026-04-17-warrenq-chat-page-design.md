# Warrenq 综合助手聊天页面设计文档

> 作者：胡丹
> 日期：2026-04-17
> Figma 来源：综合助手小龙虾 (node 8:48955)

## 1. 概述

基于 Figma 设计，为 Gildata/Warrenq 渠道构建独立的全屏聊天助手页面（"综合助手小龙虾"），脱离 OpenClaw UI 框架的 Tab 导航体系。

**核心决策：**
- 页面定位：完全独立全屏页面，登录后跳转进入
- 后端协议：复用 OpenClaw Gateway WebSocket 协议
- 前端框架：Lit Web Components 组件组合模式

## 2. 组件架构

```
warrenq-chat-page (全屏页面)
├── warrenq-sidebar          # 左侧导航栏 (240px)
│   ├── logo 区域            # "综合助手小龙虾" 品牌标识
│   ├── 新建对话按钮          # 创建新会话
│   ├── 搜索框               # 过滤对话列表
│   └── 对话列表             # 可滚动的会话历史
├── warrenq-chat-main        # 右侧主聊天区域
│   ├── 聊天头部             # 当前对话标题 / 助手信息
│   ├── 消息流容器           # 可滚动消息列表
│   │   └── warrenq-chat-message (repeat)  # 单条消息气泡
│   └── warrenq-chat-input   # 底部输入区域
│       ├── 文本输入框 (textarea, 自适应高度)
│       └── 发送按钮
```

## 3. 文件结构

```
ui/src/ui/views/
├── warrenq-chat-page.ts        # 页面组合器 + WebSocket 管理 + 状态中心
├── warrenq-chat-sidebar.ts     # 侧边栏组件 (Logo/新建/搜索/对话列表)
├── warrenq-chat-main.ts        # 主聊天区域 (消息流容器)
├── warrenq-chat-message.ts     # 单条消息气泡组件
├── warrenq-chat-input.ts       # 输入区域 (textarea + 发送按钮)
└── warrenq-login.ts            # 已有，登录成功后跳转到 /warrenq-chat

extensions/gildata/src/
└── warrenq-chat-route.ts       # 后端路由：/warrenq-chat 返回独立 HTML 页面
```

## 4. 数据流

### 4.1 组件通信

- **向上**：子组件通过 `CustomEvent` 冒泡（dispatch）
- **向下**：`warrenq-chat-page` 通过 Lit `@property` 传递数据

### 4.2 WebSocket 连接

由 `warrenq-chat-page` 统一管理：

```
用户发送消息 → chat-input dispatch → chat-page 建立 WS → Gateway
Gateway 响应 → chat-page onmessage → 更新 messages 属性 → chat-main/chat-message
```

### 4.3 会话管理

- 新建对话：`POST /api/sessions` → 返回新 sessionKey
- 切换对话：sidebar dispatch → chat-page 切换 sessionKey → 加载历史 `GET /api/chat`
- 删除对话：`DELETE /api/sessions/:key`

### 4.4 核心状态模型

```typescript
interface ChatPageState {
  sessions: Session[];
  activeSessionKey: string;
  messages: Message[];
  connected: boolean;
  sending: boolean;
  stream: string | null;
}

interface Session {
  key: string;
  title: string;
  updatedAt: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
```

## 5. 路由与入口

### 5.1 页面入口

Warrenq 登录成功后跳转：
```
window.location.href = basePath + "/warrenq-chat"
```

### 5.2 后端路由

Gildata 扩展注册 `/warrenq-chat` GET 路由，返回独立 HTML 页面：
- 加载 Lit 运行时和各组件的 JS bundle
- 不依赖 OpenClaw 控制面板的 HTML 模板
- 页面内含 CSS 变量定义的暗色主题

### 5.3 认证

依赖 Warrenq 登录成功后的 cookie/session。未认证时重定向到登录页。

## 6. 样式与主题

### 6.1 暗色主题 CSS 变量

```css
:root {
  --wq-bg-primary: #0d1117;
  --wq-bg-sidebar: #161b22;
  --wq-bg-card: #1a1a2e;
  --wq-bg-input: #0d1117;
  --wq-border: #30363d;
  --wq-text-primary: #e0e0e0;
  --wq-text-secondary: #888;
  --wq-accent: #667eea;
  --wq-accent-hover: #5a6fd6;
  --wq-user-bubble: #2d5aa0;
  --wq-assistant-bubble: #1e1e2e;
}
```

### 6.2 布局规则

- 全屏 Flexbox，`100vh` 无滚动条
- 侧边栏固定 240px，可折叠至图标模式（64px）
- 聊天区自适应剩余宽度
- 消息区域 `overflow-y: auto`，自动滚动到最新消息
- 输入框 `textarea` 自适应高度，最大 200px

### 6.3 响应式

- 最小宽度 768px
- 低于 768px 时侧边栏自动折叠为图标模式

## 7. 组件职责明细

### warrenq-chat-page
- 持有 WebSocket 连接和核心状态（sessions、messages、connected）
- 组合 sidebar + chat-main
- 监听子组件事件，协调状态更新
- 处理认证检查（未登录则重定向）

### warrenq-chat-sidebar
- 展示品牌 Logo
- "新建对话"按钮 → dispatch `warrenq-new-session`
- 搜索框过滤对话列表
- 对话列表渲染，选中态高亮
- 点击对话项 → dispatch `warrenq-switch-session`

### warrenq-chat-main
- 渲染消息列表（repeat 指令）
- 接收 `messages` 和 `stream` 属性
- 自动滚动到最新消息
- 包含 chat-input 组件

### warrenq-chat-message
- 接收单条 message 属性
- 根据 role 渲染不同气泡样式（用户蓝/助手暗）
- 支持 Markdown 渲染（复用现有 markdown 工具）

### warrenq-chat-input
- 自适应高度 textarea
- Enter 发送，Shift+Enter 换行
- 发送按钮（发送中显示 spinner）
- dispatch `warrenq-send-message`

## 8. 错误处理

- WebSocket 断连：显示重连提示，自动指数退避重连
- 消息发送失败：气泡显示红色标记 + 重试按钮
- 会话加载失败：toast 提示错误信息
- 未认证：重定向到登录页
