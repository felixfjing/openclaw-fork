# Chat Tool Summary Nodes

这份说明整理了聊天界面里 tool summary 节点的情况，重点是共享的 chat-group 渲染路径中出现的两个 DOM 选择器：

- `chat-tool-msg-summary__label`
- `chat-tool-msg-summary__names`

## 范围

这套 summary 结构在以下实现里是共用的：

- `ui/src/ui/chat-claw/grouped-render.ts`
- `ui/src/ui/chat-claw/tool-cards.ts`
- `ui/src/ui/chat/grouped-render.ts`
- `ui/src/ui/chat/tool-cards.ts`

## 类型数量

### `chat-tool-msg-summary__label`

在渲染逻辑里能看到的固定标签类型只有两种：

1. `Tool output`
2. `Tool call`

所以 `label` 这一侧的固定类型数是 2。

### `chat-tool-msg-summary__names`

这一项不是固定枚举，而是动态渲染工具名。

观察到的结构是：

- 对于折叠的 tool card，它只显示 1 个工具名，也就是 `card.name`。
- 对于 tool message summary，它显示该消息里去重后的工具名列表。
- 如果列表里有 3 个或更少的名字，就用逗号连接显示。
- 如果列表里超过 3 个名字，就显示前 2 个名字，再追加 `+N more`。

所以 `names` 这一侧是动态值集合，不是封闭的固定类型列表。

## 实际汇总

| 选择器                         | 作用           | 数量                                                  |
| ------------------------------ | -------------- | ----------------------------------------------------- |
| `chat-tool-msg-summary__label` | 固定摘要标签   | 2                                                     |
| `chat-tool-msg-summary__names` | 动态工具名展示 | 每个 tool card 1 个，或每个 tool message 1 组去重列表 |

## 代码和测试里能看到的例子

- `Tool output`
- `Tool call`
- `canvas_render`
- `browser.open`
- `sessions_spawn`

## 实现说明

tool message summary 会先从消息 payload 里取出唯一的 tool name 列表，再压缩成更紧凑的展示形式。也就是说，界面上看到的 `names` 字符串是数据驱动的，会随着 tool message 内容变化；而 `label` 字符串始终只会落在上面那 2 个值里。
