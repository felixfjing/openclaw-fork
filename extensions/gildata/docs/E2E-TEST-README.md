# warrenq认证流程E2E测试运行说明

**创建日期：** 2026-04-16
**作者：** 胡丹

## 概述

本文档说明如何运行warrenq认证流程的端到端（E2E）测试。

## 测试文件

- **主测试文件：** `extensions/gildata/src/warrenq-auth.e2e.test.ts`
- **测试覆盖：** 完整认证流程、token管理、错误处理、重试逻辑等

## 前置要求

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建项目

```bash
pnpm build
```

## 运行测试

### 模拟测试（无需真实API）

默认情况下，测试使用mock的fetch函数，不需要连接真实API：

```bash
# 运行所有E2E测试
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts

# 使用vitest直接运行
bun run vitest run extensions/gildata/src/warrenq-auth.e2e.test.ts
```

### 真实API测试

要运行使用真实warrenq API的测试，需要设置环境变量：

```bash
# 启用真实API测试
export warrenq_LIVE_TEST=1

# 或者使用项目通用的LIVE变量
export LIVE=1

# 可选：自定义测试API URL
export warrenq_TEST_API_URL=https://api.warrenq.com

# 运行测试
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts
```

### 测试凭证

真实API测试使用以下测试凭证：

- **用户名：** 18627556862
- **密码：** CV1626%35%32%33%38%99%101%119%96%18

这些凭证已硬编码在测试文件中，仅供测试使用。

## 测试场景

### 测试用例1: 完整登录流程
- 验证成功登录并获取token
- 验证租户信息正确提取
- 验证token正确保存

### 测试用例2: Token过期处理
- 检测token过期（401错误）
- 重新登录获取新token
- 验证新token有效

### 测试用例3: 网络错误重试
- 自动重试网络错误
- 达到最大重试次数后放弃
- 使用指数退避策略

### 测试用例4: 认证失败处理
- 处理无效凭证错误
- 处理服务器错误
- 处理无效响应
- 提供用户友好的错误消息

### 测试用例5: 并发登录请求
- 正确处理并发登录请求
- 正确处理部分失败场景

### 测试用例6: Token持久化和恢复
- 保存token到文件
- 从文件恢复token
- 清除保存的token
- 验证token结构完整性
- 验证文件权限设置

### 测试用例7: 错误恢复流程
- 从网络错误中恢复
- 提供详细错误日志
- 正确传播原始错误信息

## 测试环境配置

### 环境变量

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `warrenq_LIVE_TEST` | 启用真实API测试 | `0` | 否 |
| `LIVE` | 启用所有真实API测试 | `0` | 否 |
| `warrenq_TEST_API_URL` | 测试API URL | `https://api.warrenq.com` | 否 |

### 测试API端点

- **登录API：** `https://api.warrenq.com/cloudtest/oauth/v2/oauth/login`
- **租户信息API：** `https://api.warrenq.com/cloudtest/platform/v2/sysUser/self`

## 测试隔离和清理

所有测试都设计了隔离机制：

1. **内存存储：** 默认使用`MemoryTokenStorage`避免污染文件系统
2. **临时目录：** 文件存储测试使用临时目录，测试后自动清理
3. **Mock重置：** 每个测试后重置mock函数

## 运行特定测试

```bash
# 运行特定测试套件
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts -t "测试用例1"

# 运行匹配模式的测试
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts -t "token"

# 查看详细输出
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts --reporter=verbose
```

## 调试测试

```bash
# 运行测试并保持watch模式
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts --watch

# 调试模式
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts --debug

# 只运行失败的测试
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts --bail
```

## 测试覆盖率

```bash
# 生成覆盖率报告
pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts --coverage
```

## 故障排除

### 测试失败

1. **网络错误：** 检查网络连接和API端点是否可访问
2. **认证失败：** 确认测试凭证有效
3. **超时：** 增加测试超时时间或检查网络延迟

### 清理问题

如果临时文件未被清理，可以手动删除：

```bash
# 删除临时测试文件
rm -rf /tmp/warrenq-e2e-test-*

# 删除gildata-token.json
rm -f ~/.openclaw/gildata-token.json
```

## CI/CD集成

在CI环境中，可以跳过真实API测试：

```yaml
# 示例：GitHub Actions
- name: Run E2E tests (mock)
  run: pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts

- name: Run E2E tests (live)
  if: github.event_name == 'schedule'
  env:
    warrenq_LIVE_TEST: 1
  run: pnpm test extensions/gildata/src/warrenq-auth.e2e.test.ts
```

## 注意事项

1. **安全：** 测试凭证仅供测试使用，不要在生产环境中使用
2. **速率限制：** 频繁的API调用可能触发速率限制
3. **环境隔离：** 使用单独的测试环境，不要影响生产数据
4. **清理：** 测试完成后确保清理所有临时文件

## 相关文档

- [warrenq认证文档](./warrenq-USAGE.md)
- [测试用例说明](./E2E-TEST-CASES.md)
- [错误处理文档](./ERROR-HANDLING.md)
