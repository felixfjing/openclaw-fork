# 技能（Skills）存储目录信息

## 技能数据来源

技能数据由 `buildWorkspaceSkillStatus()` 合并三个来源返回，共加载了 86 个技能。

| 来源 | 路径 | 说明 |
|------|------|------|
| **工作区技能** | `{workspaceDir}/skills/` | 用户自定义技能，当前工作区为 `/Users/hudan/.openclaw/workspace/skills/`（当前为空） |
| **托管技能** | `~/.openclaw/skills/` | 通过 ClawHub 安装的技能 |
| **捆绑技能** | `{openclaw安装目录}/skills/` | 随 openclaw 一起发布的内置技能，即 `/Volumes/Data/Project/StudyPro/AiPro/openclaw/skills/`（54个） |

## 相关代码链路

| 文件 | 说明 |
|------|------|
| `src/agents/skills-status.ts:228` | `buildWorkspaceSkillStatus()` 合并三个来源 |
| `src/agents/skills.ts` | `loadWorkspaceSkillEntries()` 加载技能文件 |
| `src/gateway/server-methods/skills.ts:69` | `skills.status` RPC 入口 |
| `ui/src/ui/controllers/skills.ts:105` | 前端 `loadSkills()` 调用 RPC |
| `ui/src/ui/views/chat-standalone/state.ts:115` | 聊天页面 `loadSkillsList()` 加载技能到下拉列表 |
