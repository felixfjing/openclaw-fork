# 经验教训

## 2026-04-18: Web 安装向导实施

### 1. Gateway 进程管理
- **问题**: 旧 gateway 进程在后台持续运行，新的 curl 测试命中旧代码导致误判
- **解决**: 每次重启前用 `lsof -i :18789 | grep LISTEN` 确认端口完全释放，用 `kill -9 <PID>` 强杀残留进程

### 2. tsdown 与 UI 资源冲突
- **问题**: `node scripts/tsdown-build.mjs` 会清理 `dist/` 目录，导致 `dist/control-ui/` 下的 UI 构建产物被删除
- **解决**: 先 `tsdown-build`（后端），再 `cd ui && pnpm build`（前端），顺序不可颠倒；或让 gateway 自动构建 UI（较慢）

### 3. `import.meta.url` 在 tsdown 编译后不可靠
- **问题**: tsdown 产出扁平化哈希文件名（如 `server.impl-ALdbmIkE.js`），`import.meta.url` 路径与源码目录结构无关
- **解决**: 使用 `process.argv[1]` + `import.meta.url` 双重回溯，向上查找 `scripts/download-uv.mjs` 作为 marker

### 4. API 响应结构与前端解构不匹配
- **问题**: API 返回 `{"uvInstalled": true, ...}` 扁平结构，但前端代码用 `result.state.uvInstalled` 访问
- **解决**: 确保前后端对 API schema 保持一致，前端直接访问 `result.uvInstalled`

### 5. 配置 schema 验证
- **问题**: 写入 `~/.openclaw/openclaw.json` 的顶层 `providers` key 被 schema 验证拒绝（Unrecognized key）
- **解决**: Provider 配置必须写入 `models.providers` 路径下，符合 openclaw 的配置 schema
