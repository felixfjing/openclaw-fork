# warrenq认证使用指南

**日期：** 2026年4月15日
**作者：** 胡丹

## 概述

本文档描述如何配置和使用Gildata Provider的warrenq完整认证功能。

## 认证流程

```
用户终端输入
    ↓
warrenq登录API (用户名+密码)
    ↓
获取access_token
    ↓
调用租户信息API (使用access_token)
    ↓
解析tenantId和userId
    ↓
保存到存储
    ↓
OpenClaw聊天请求 (自动添加认证头)
```

## 快速开始

### 1. 基础配置

通过环境变量或配置文件设置：

```bash
# 设置环境变量
export warrenq_USERNAME=your-username
export warrenq_PASSWORD=your-password

# 或通过OpenClaw配置
openclaw config set providers.gildata.autoLogin true
```

### 2. 执行认证

```bash
# 方法1：通过配置文件
openclaw config set providers.gildata.autoLogin true

# 方法2：通过命令行参数
openclaw --warrenq-auto-login

# 方法3：交互式配置
openclaw auth configure --provider gildata
```

## 配置选项

### warrenq登录配置

| 配置项 | 类型 | 默认值 | 说明 |
|---------|------|---------|------|
| autoLogin | boolean | false | 启用warrenq自动登录 |
| loginBaseUrl | string | https://api.warrenq.com | warrenq登录API URL |
| username | string | - | warrenq用户名（自动登录用） |
| password | string | - | warrenq密码（自动登录用） |
| chatBaseUrl | string | http://aigwtest.in.gildata.com:31088/nlp-dataagent-srv/v1/chat/completions | Gildata聊天API URL |

### 聊天请求配置

| 配置项 | 类型 | 默认值 | 说明 |
|---------|------|---------|------|
| agentId | string | gildata-claw | 聊天请求中的Agent-Id固定标识 |
| userId | string | - | 用户ID（从warrenq响应中解析） |
| queryId | string | - | 查询ID（UUID格式） |
| sessionId | string | - | 会话ID |
| tenantId | string | - | 租户ID（从warrenq响应中解析） |
| moduleId | string | claw | 模块ID（聊天请求中的X-Module-Id） |
| contentType | string | application/json | Content-Type请求头 |

## 使用示例

### 示例1：启用warrenq自动登录

```bash
# 设置自动登录并配置用户凭证
export warrenq_USERNAME=testuser
export warrenq_PASSWORD=testpass
openclaw config set providers.gildata.autoLogin true
openclaw config set providers.gildata.username testuser
openclaw config set providers.gildata.password testpass
```

### 示例2：手动登录

```bash
# 通过OpenClaw命令行进行手动登录
openclaw auth configure --provider gildata --method warrenq

# 输入：
# warrenq用户名: testuser
# warrenq密码: testpass123

# 登录成功后，系统会自动保存token信息
```

### 示例3：聊天请求

```bash
# 配置完成后，发起聊天
openclaw chat "你好，请介绍一下你自己"

# 系统会自动添加以下请求头：
# Authorization: Bearer {access_token}
# X-Agent-Id: gildata-claw
# X-User-Id: {userId}
# X-Tenant-Id: {tenantId}
# X-Module-Id: claw
# Content-Type: application/json
```

### 示例4：查看登录状态

```bash
# 查看当前登录配置
openclaw config show providers.gildata

# 输出示例：
# {
#   "autoLogin": true,
#   "loginBaseUrl": "https://api.warrenq.com",
#   "chatBaseUrl": "http://aigwtest.in.gildata.com:31088/nlp-dataagent-srv/v1/chat/completions",
#   "username": "testuser",
#   "tenantId": "tenant-123",
#   "userId": "user-456"
# }
```

## 认证方式对比

### warrenq完整认证

**优点：**
- ✅ 完整的登录流程（C#终端输入）
- ✅ 自动token管理和刷新
- ✅ 动态请求头生成
- ✅ 租户信息解析（tenantId, userId）
- ✅ 支持查询ID、会话ID等自定义头
- ✅ 灵活的配置选项

**缺点：**
- 需要维护用户名和密码
- 依赖warrenq服务可用性

### API Key认证（原有方式）

**优点：**
- ✅ 配置简单
- ✅ 不需要额外凭证
- ✅ 轻量级

**缺点：**
- ❌ 无法获取动态用户信息
- ❌ 请求头信息有限

## 故障排除

### 登录失败

**问题：** 登录提示"用户名或密码错误"
**解决方法：**
1. 检查环境变量`warrenq_USERNAME`和`warrenq_PASSWORD`是否正确设置
2. 验证配置中的用户名和密码是否正确
3. 确认网络连接是否正常

**问题：** 无法获取access_token
**解决方法：**
1. 检查warrenq服务是否可访问
2. 查看错误日志获取详细信息
3. 尝试手动登录验证

### Token过期

**问题：** 认证失败"Authorization token无效"
**解决方法：**
1. 运行`openclaw config set providers.gildata.autoLogin true`重新登录
2. 或删除存储的token后重新配置

### 聊天请求失败

**问题：** 401 Unauthorized
**可能原因：**
1. Token已过期
2. tenantId或userId不正确
3. 请求头格式错误

**解决方法：**
1. 检查登录状态和token有效性
2. 查看配置中的凭证信息
3. 查看聊天API URL是否正确

**问题：** 500 Internal Server Error
**可能原因：**
1. Gildata聊天服务不可用
2. warrenq服务不可用
3. 网络连接问题

**解决方法：**
1. 检查服务可用性
2. 查看错误日志
3. 尝试稍后重试

## API端点说明

### warrenq登录API

- **登录URL**: `https://api.warrenq.com/cloudtest/oauth/v2/oauth/login`
- **方法**: POST
- **Content-Type**: `multipart/form-data`

### 租户信息API

- **URL**: `https://api.warrenq.com/cloudtest/platform/v2/sysUser/self`
- **方法**: POST
- **Authorization**: `Bearer {access_token}`

### Gildata聊天API

- **URL**: `http://aigwtest.in.gildata.com:31088/nlp-dataagent-srv/v1/chat/completions`
- **方法**: POST
- **Content-Type**: `application/json`

**必需请求头：**
```json
{
  "X-Agent-Id": "gildata-claw",
  "X-User-Id": "{userId}",
  "X-Tenant-Id": "{tenantId}",
  "X-Module-Id": "claw"
}
```

## 环境变量

| 变量名 | 用途 | 默认值 | 说明 |
|------|------|---------|------|
| GILDATA_API_TOKEN | API Key | - | 直接API Key认证 |
| warrenq_USERNAME | 用户名 | - | warrenq登录用户名 |
| warrenq_PASSWORD | 密码 | - | warrenq登录密码 |
| warrenq_TENANT_ID | 租户ID | - | 租户ID（从解析） |
| warrenq_USER_ID | 用户ID | - | 用户ID（从解析） |

## 配置命令速查

```bash
# 查看所有配置
openclaw config show providers.gildata

# 修改单个配置
openclaw config set providers.gildata.autoLogin true

# 删除配置
openclaw config delete providers.gildata.username

# 查看环境变量
openclaw config list --filter gildata
```

## 开发测试

### 本地测试

```bash
# 进入gildata目录
cd extensions/gildata

# 运行测试
pnpm test

# 运行特定测试文件
pnpm test src/warrenq-auth.test.ts

# 查看测试覆盖率
pnpm test:coverage src/warrenq-auth.test.ts
```

## 安全注意事项

1. **凭证安全**
   - ⚠️️ 不要在代码中硬编码用户名和密码
   - ⚠️️ 使用环境变量存储敏感信息
   - ⚠️️ 定期更换密码

2. **Token安全**
   - ✅ Token通过HTTPS传输
   - ✅ Token存储在内存中（会话结束时清除）
   - ✅ 支持Token刷新

3. **网络安全**
   - ✅ 使用HTTPS协议
   - ✅ 验证SSL证书
   - ✅ 使用请求超时保护

4. **数据保护**
   - ✅ 不在日志中记录敏感信息
   - ✅ 遵守用户隐私数据

## 下一步

- [ ] 完善错误处理和重试机制
- [ ] 添加Token刷新支持
- [ ] 添加请求日志记录
- [ ] 添加性能监控
- [ ] 编写更多集成测试
- [ ] 添加E2E测试

---

**文档版本**: 1.0
**最后更新**: 2026年4月15日
