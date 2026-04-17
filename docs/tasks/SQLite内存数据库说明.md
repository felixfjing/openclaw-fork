# SQLite 内存数据库 (main.sqlite) 说明

> 作者：胡丹
> 创建日期：2026-04-14

## 文件概述

`~/.openclaw/memory/main.sqlite` 是 OpenClaw 内置内存引擎的 SQLite 数据库文件，用于存储内存搜索索引。

## 文件位置

### 默认位置

```
~/.openclaw/memory/<agentId>.sqlite
```

对于默认代理（`DEFAULT_AGENT_ID`），文件名为 `main.sqlite`。

### 完整路径示例

```
/Users/username/.openclaw/memory/main.sqlite              # macOS/Linux
C:\Users\username\.openclaw\memory\main.sqlite   # Windows
```

**关键代码：** `docs/concepts/memory-builtin.md:62`

> Index location: `~/.openclaw/memory/<agentId>.sqlite`

## 数据库结构

### 主要表

#### 1. `chunks_vec` - 向量搜索表

**用途：** 存储文本块的向量嵌入（embeddings）

**关键字段：**
- `id`: 唯一标识符（文本块的路径哈希）
- `embedding`: BLOB 类型的向量数据
- `model`: 使用的嵌入模型

**关键代码：** `extensions/memory-core/src/memory/manager-vector-dedupe.ts:15`

```typescript
db.exec("CREATE TABLE chunks_vec (id TEXT PRIMARY KEY, embedding BLOB)");
```

#### 2. `chunks_fts` - 全文搜索表

**用途：** 使用 FTS5 实现全文索引和 BM25 评分

**关键字段：**
- `path`: 文本块的文件路径
- `source`: 来源标识（如 "memory-root"）
- `model`: 使用的模型标识
- `text`: 索引的文本内容
- `id`: 文本块 ID
- `start_line` / `end_line`: 在源文件中的行号

**关键代码：** `extensions/memory-core/src/memory/manager-fts-state.ts:42`

```typescript
db.exec("CREATE TABLE chunks_fts (path TEXT, source TEXT, model TEXT)");
```

## 功能特性

### 搜索能力

| 功能 | 说明 | 技术实现 |
|------|------|-----------|
| 关键词搜索 | 全文搜索，支持 BM25 评分 | FTS5 |
| 向量搜索 | 语义搜索，通过 embeddings | SQLite/外部向量引擎 |
| 混合搜索 | 结合关键词和向量搜索结果 | BM25 + 余弦相似度 |
| CJK 支持 | 中文、日文、韩语分词 | 三元组 tokenization |
| 临时衰减 | 对旧结果降权 | 时间衰减算法 |

### 索引内容

**源文件：**
- `MEMORY.md` - 工作区主记忆文件
- `memory/*.md` - 工作区内的其他记忆文件

**分块策略：**
- 每块约 400 tokens
- 块之间重叠 80 tokens
- 支持代码和文本混合内容

**关键代码：** `docs/concepts/memory-builtin.md:59-60`

> OpenClaw indexes `MEMORY.md` and `memory/*.md` into chunks (~400 tokens with
> 80-token overlap) and stores them in a per-agent SQLite database.

## 删除或修改的影响

### 删除 main.sqlite

**部分自动重建 + 需要手动索引**

#### 自动部分

1. **文件自动创建**
   - SQLite 会在首次访问时自动创建新的空数据库
   - `ensureSchema()` 自动创建 `chunks_vec` 和 `chunks_fts` 表结构

**关键代码：** `extensions/memory-core/src/memory/manager-db.ts:5-14`

```typescript
export function openMemoryDatabaseAtPath(dbPath: string, allowExtension: boolean): DatabaseSync {
  const dir = path.dirname(dbPath);
  ensureDir(dir);  // 确保目录存在
  const { DatabaseSync } = requireNodeSqlite();
  const db = new DatabaseSync(dbPath, { allowExtension });  // SQLite 自动创建文件
  return db;
}
```

#### 需要手动操作

2. **索引需手动重建**
   - 数据不会自动填充到新数据库
   - 必须手动触发索引操作

```bash
# 强制重建索引（必需步骤）
openclaw memory index --force
```

#### 恢复步骤

```bash
# 1. 检查内存状态
openclaw memory status

# 2. 强制重建索引
openclaw memory index --force

# 3. 验证索引完整性
openclaw memory search "test query"
```

#### 影响总结

| 方面 | 影响 |
|------|------|
| 原始会话数据 | 不受影响（保存在 `sessions/` 目录）|
| MEMORY.md 源文件 | 不受影响 |
| 内存搜索 | 失效直到运行 `openclaw memory index --force` |
| 数据库表结构 | 自动创建 |
| 索引数据 | 需要手动重建 |

### 修改 main.sqlite

**直接修改的后果：**

1. **数据库结构损坏**
   - SQLite 文件格式错误导致无法打开
   - 内存引擎无法启动
   - 降级为只读模式并尝试恢复

**关键代码：** `extensions/memory-core/src/memory/manager-sync-control.ts:105`

```typescript
log.warn(`memory sync readonly handle detected; reopening sqlite connection`, { reason });
```

2. **数据不一致**
   - `chunks_vec` 和 `chunks_fts` 表数据不匹配
   - 向量与文本块关联错误
   - 搜索结果不准确或丢失

3. **安全恢复机制**
   - 只读模式：检测到损坏时自动切换
   - 自动重建：删除数据库并从源文件重新索引
   - 原子文件：系统会在 `memory/` 目录下创建 `.wal` 和 `.shm` 临时文件

### 数据库文件大小

**典型大小：**
- 小型使用（<100KB 源文本）：~1-5 MB
- 中型使用（100-500KB 源文本）：~5-20 MB
- 大型使用（>500KB 源文本）：~20-100 MB

**影响因素：**
- 源文件大小
- 嵌入模型维度（OpenAI 1536，Gemini 3072 等）
- 向量数据类型（浮点精度）
- 索引效率（碎片化程度）

## 故障排除

### 搜索结果为空

1. **检查索引是否建立：**
```bash
openclaw memory status
```

2. **强制重建索引：**
```bash
openclaw memory index --force
```

3. **检查源文件是否存在：**
```bash
ls -la ~/.openclaw/memory/
```

### 数据库锁定错误

**错误信息：** `SQLITE_BUSY: database is locked`

**解决方案：**
1. 等待后台索引完成（通常 30-60 秒）
2. 检查是否有其他进程占用数据库
3. 删除 `.lock` 文件（确保没有正在进行的索引操作）
4. 重启 OpenClaw 网关

### 性能问题

**症状：** 搜索响应缓慢

**优化方案：**
1. **启用 sqlite-vec：** 配置 GPU 加速（如果可用）
2. **调整分块大小：** 修改 `memorySearch.chunking.maxTokens`
3. **清理旧索引：** 删除并重建数据库
4. **限制搜索结果：** 设置 `memorySearch.limits.maxResults`

## 备份与迁移

### 备份索引

```bash
# 停止 OpenClaw（防止并发写入）
openclaw gateway stop

# 备份内存数据库
cp ~/.openclaw/memory/main.sqlite ~/.openclaw/memory/main.sqlite.backup

# 重启 OpenClaw
openclaw gateway start
```

### 迁移到新机器

```bash
# 复制整个内存目录
scp -r ~/.openclaw/memory/ user@new-host:~/.openclaw/

# 在新机器上验证索引
openclaw memory status
```

## 与其他系统的集成

### 工作区集成

**Memory 文件位置：**
- 默认：`~/.openclaw/memory/` 或工作区 `memory/` 子目录
- 配置覆盖：`agents.defaults.memorySearch.qmd.paths.path`

**关键代码：** `src/memory-host-sdk/host/backend-config.ts:338`

```typescript
{ path: workspaceDir, pattern: "MEMORY.md", base: "memory-root" }
```

### 多代理支持

每个代理有独立的内存数据库：
```
~/.openclaw/memory/
├── default.sqlite       # 默认代理
├── agent-1.sqlite      # 自定义代理 1
└── agent-2.sqlite      # 自定义代理 2
```

**关键代码：** `extensions/memory-core/src/memory/qmd-manager.ts:225`

```typescript
store: { path: path.join(workspaceDir, "index.sqlite"), vector: { enabled: false } }
```

`★ Insight ─────────────────────────────────────`
1. **双表设计**：`chunks_vec`（向量）和 `chunks_fts`（全文）的分离设计支持混合搜索策略，平衡精确匹配和语义相关性
2. **容错机制**：检测到损坏时自动切换只读模式，并尝试从源文件重建，保证核心功能不中断
3. **并发控制**：通过 `PRAGMA busy_timeout = 5000` 和文件锁机制处理多进程并发访问，防止数据库损坏
`─────────────────────────────────────────────────`
