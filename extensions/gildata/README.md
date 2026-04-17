# Gildata Provider Plugin

Gildata Provider是OpenClaw的官方提供商插件，提供与Gildata AI服务的完整集成。

## 功能特性

- 🎯 聊天对话支持
- 🔐 warrenq系统认证集成（动态请求头部）
- 📊 动态模型列表获取
- 🏷️ 模型别名映射
- 🌐 自定义API端点支持
- 🔧 灵活的认证配置

## 开发

该插件遵循OpenClaw插件架构，位于extensions目录中作为内置插件。

## 认证方式

### warrenq系统认证

warrenq系统认证会自动从warrenq系统传递以下动态头部：

- `Authorization`: 用户认证令牌
- `X-warrenq-User-Id`: 用户ID
- `X-warrenq-Session-Id`: 会话ID
- `X-warrenq-Tenant-Id`: 租户ID

这些头部是动态的，会在每次请求时从warrenq系统获取最新值。

### API Key认证

也支持直接的API Key认证：

```bash
export GILDATA_API_TOKEN=your-api-token
```

或通过CLI配置：

```bash
openclaw config set providers.gildata.apiKey your-api-token
```

### 环境变量

warrenq认证相关的环境变量：

- `GILDATA_API_TOKEN`: Gildata API令牌
- `warrenq_USER_ID`: warrenq用户ID（可选）
- `warrenq_SESSION_ID`: warrenq会话ID（可选）
- `warrenq_TENANT_ID`: warrenq租户ID（可选）

## 模型别名

为了提供更友好的模型名称，Gildata支持以下模型别名映射：

| 别名 | 实际模型 |
|------|---------|
| qwen-plus | qwen-plus |
| deepseek-r1 | deepseek-r1 |
| qwen2-72b | qwen2-72b-instruct-aliyun |
| qwen-max | qwen-max-latest |
| qwen-plus-aliyun | qwen-plus-latest-aliyun |
| qwen-plus-latest | qwen-plus-latest |

## 配置选项

### 完整配置

可以通过OpenClaw配置文件设置Gildata相关选项：

| 配置项 | 默认值 | 描述 |
|---------|---------|------|
| providers.gildata.warrenqEnabled | false | 启用warrenq系统认证 |
| providers.gildata.apiKey | - | Gildata API令牌 |
| providers.gildata.warrenqBaseUrl | - | warrenq API基础URL |
| providers.gildata.customHeaders | {} | 自定义HTTP请求头 |

### 配置示例

```json
{
  "models": {
    "providers": {
      "gildata": {
        "warrenqEnabled": true,
        "apiKey": "your-api-key",
        "warrenqBaseUrl": "https://api.gildata.com",
        "customHeaders": {
          "X-Custom-Header": "custom-value"
        }
      }
    }
  }
}
```

## 使用示例

### 聊天对话

```bash
# 使用默认模型
openclaw chat "你好"

# 指定模型（使用别名）
openclaw chat --model qwen-plus "介绍一下你自己"

# 指定实际模型ID
openclaw chat --model qwen-max-latest "写一段代码"
```

### 动态模型查询

```bash
# 查看所有可用模型
openclaw models list --provider gildata

# 查看模型详情
openclaw models show --provider gildata qwen-plus
```

## 架构

### 文件结构

```
extensions/gildata/
├── src/
│   ├── index.ts                    # 插件入口
│   ├── api.ts                      # API实现
│   ├── warrenq-auth.ts            # warrenq认证模块
│   ├── dynamic-models.ts            # 动态模型管理
│   ├── warrenq-auth.test.ts         # 认证测试
│   ├── dynamic-models.test.ts       # 模型测试
│   └── index.test.ts               # 基础测试
├── openclaw.plugin.json            # 插件清单
├── package.json                  # 包配置
├── tsconfig.json                  # TypeScript配置
└── README.md                     # 本文档
```

### 关键模块

#### warrenq-auth.ts
- warrenq认证头部处理
- 认证配置管理
- 交互式和非交互式配置
- 运行时认证准备

#### dynamic-models.ts
- 模型别名映射
- 动态模型列表获取
- 模型定义转换
- Gildata API客户端

#### api.ts
- 提供商发现
- 动态模型准备
- 运行时认证处理
- 模型别名导出

## 开发指南

### 运行测试

```bash
# 单元测试
pnpm test extensions/gildata

# 覆盖率测试
pnpm test:coverage extensions/gildata
```

### 构建项目

```bash
# 构建整个项目
pnpm build

# 只构建gildata插件
cd extensions/gildata && pnpm build
```

### 类型检查

```bash
# TypeScript类型检查
pnpm tsgo --noEmit
```

## 故障排除

### 认证失败

如果遇到认证错误：

1. 检查API Token是否正确配置
2. 验证Token是否过期
3. 检查网络连接
4. 查看warrenq系统是否正常运行

### 模型不可用

如果遇到模型不可用错误：

1. 运行 `openclaw models list --provider gildata` 查看当前可用模型
2. 检查模型别名是否正确
3. 验证Gildata API是否可访问

### 连接问题

如果遇到连接问题：

1. 检查API端点配置
2. 验证网络连接和代理设置
3. 查看错误日志获取更多信息

## 许可证

MIT License
