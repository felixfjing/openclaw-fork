# 定时任务管理页面 - 实施计划

> 作者：胡丹
> 日期：2026-04-19

## 任务清单

### P0："更多"按钮跳转
- [x] empty-state.ts 中 "更多" 按钮添加点击事件，跳转到 cron 页面

### P1：卡片式布局
- [x] cron.ts 新增 renderCronCardGrid 和 renderCronCard 函数
- [x] 添加 play/pause 图标到 icons.ts
- [x] 添加卡片视图 CSS 样式
- [x] 替换列表视图为卡片视图

### P2：搜索与筛选
- [x] 添加分段控制器组件（全部/已启用/已禁用）
- [x] 添加搜索框到工具栏
- [x] 添加 "新增" 按钮
- [x] 添加工具栏 CSS 样式（cron-toolbar, cron-segmented 等）

### P3：独立路由页面（已有方案替代）
- [x] "更多>" 按钮直接跳转到 /cron 路由（已实现）
- [x] /cron 页面已包含完整卡片布局、分段控制器、搜索和新增（P1+P2 完成）
- ~~新建 chat-standalone/cron-page.ts~~ — 无需额外子路由
- ~~添加子路由支持~~ — 现有 /cron 路由已满足需求
- ~~左侧导航集成~~ — 控制面板自带左侧导航

## 进度记录

- P0 ✅ "更多"按钮跳转 — empty-state.ts 添加 window.location.href 跳转
- P1 ✅ 卡片式布局 — cron.ts 新增 renderCronCardGrid/renderCronCard，icons.ts 添加 play/pause，components.css 添加卡片样式
- P2 ✅ 搜索与筛选 — cron.ts 添加分段控制器/搜索框/新增按钮，components.css 添加工具栏样式
- P3 ✅ 独立路由 — 复用现有 /cron 路由，移除 summary-strip，runs 条件化显示
- P4 ✅ Chat Standalone 子视图 — 新建 cron-page.ts，添加 cronSubView 状态切换，"更多>" 按钮改为子视图而非导航
- P5 ✅ Hash 路由改造 — cronSubView 状态切换改为 hash 路由(#cron)，"更多>" 按钮使用 window.location.hash 导航，cron-page 重设计匹配 Figma(左侧导航栏+页签+工具栏+卡片网格)

## 定时任务新增页面（#cron/create）

### P0：表单组件骨架
- [x] 新建 `chat-standalone/cron-create.ts`，实现表单布局（任务基础信息 + 执行规则设置）
- [x] 在 `state.ts` 添加 `CronCreateForm` 接口和默认值工厂
- [x] 添加 `.cron-create` 系列 CSS 样式到 `chat-standalone.css`

### P1：路由集成
- [x] `chat-standalone.ts` 扩展 hash 路由：`#cron/create` 分支
- [x] `cron-page.ts` "新增" 按钮改为 `window.location.hash = '#cron/create'`
- [x] 取消/保存按钮返回 `#cron`

### P2：表单交互
- [x] 任务名称输入框（必填）
- [x] 工作空间下拉选择
- [x] 提示词文本域（115px 高）
- [x] 执行周期单选按钮（每天/交易日/每周/每月 + 关联下拉）
- [x] 执行时间选择器（时 + 分 下拉）
- [x] 表单双向绑定 `onFormChange`

### P3：模型选择器
- [x] 文本域底部模型选择栏（复用 `props.modelSelectState`）
- [x] 下拉选择模型，显示当前选中模型名称

### P4：操作按钮
- [x] 底部操作栏：删除（红色边框）、测试运行（边框+play图标）、暂停（边框+pause图标）
- [x] 取消按钮（默认样式）+ 保存按钮（#0080ff 主色）
- [x] 必填校验（任务名称、执行周期、执行时间）

### 进度记录

- 实施方案：`docs/tasks/定时任务新增页面实施方案.md`
