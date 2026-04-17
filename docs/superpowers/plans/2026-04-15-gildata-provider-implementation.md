# Gildata提供商集成实现计划

**日期：** 2026年4月15日  
**作者：** 胡丹  
**项目：** OpenClaw Gildata Provider集成

## 1. 项目概述

### 1.1 目标
实现一个完整的Gildata提供商集成，包括认证、模型管理、聊天和图像生成功能。

### 1.2 依赖项
- Node.js 22+
- TypeScript
- OpenClaw核心功能

### 1.3 预期交付物
- 完整的Gildata提供商插件
- 单元测试和集成测试
- API文档和使用示例

## 2. 文件结构映射

```
gildata-provider/
├── src/
│   ├── index.ts              # 插件入口点
│   ├── client/
│   │   ├── gildata.client.ts   # API客户端实现
│   │   ├── types.ts            # 类型定义
│   │   └── auth.ts             # 认证处理
│   ├── services/
│   │   ├── chat.service.ts     # 聊天服务
│   │   ├── image.service.ts    # 图像生成服务
│   │   ├── catalog.service.ts  # 模型目录服务
│   │   └── usage.service.ts    # 使用追踪服务
│   ├── hooks/
│   │   ├── chat.hook.ts        # 聊天钩子
│   │   ├── image.hook.ts       # 图像生成钩子
│   │   └── health.hook.ts      # 健康检查钩子
│   ├── utils/
│   │   ├── error.ts            # 错误处理
│   │   ├── logger.ts           # 日志工具
│   │   └── validators.ts       # 验证工具
│   └── types/
│       ├── gildata.types.ts    # Gildata特定类型
│       └── plugin.types.ts     # 插件类型
├── tests/
│   ├── unit/
│   │   ├── client.test.ts      # 客户端测试
│   │   ├── chat.test.ts        # 聊天测试
│   │   ├── image.test.ts       # 图像生成测试
│   │   └── auth.test.ts       # 认证测试
│   ├── integration/
│   │   ├── api.test.ts         # API集成测试
│   │   └── workflow.test.ts    # 工作流测试
│   └── fixtures/
│       ├── responses/
│       └── mocks/
├── package.json               # 依赖配置
├── gildata.plugin.json      # 插件清单
└── README.md                 # 文档
```

## 3. 任务分解

### 阶段1：基础设置

#### 任务1.1：插件初始化
- **目标**: 创建插件基础结构
- **步骤**:
  1. 创建插件目录结构
  2. 初始化package.json
  3. 创建插件清单文件
  4. 设置TypeScript配置

**文件修改**:
- `gildata-provider/package.json`
```json
{
  "name": "@openclaw/gildata-provider",
  "version": "0.1.0",
  "description": "Gildata provider for OpenClaw",
  "main": "dist/index.js",
  "type": "module",
  "dependencies": {
    "zod": "^3.22.0",
    "undici": "^5.28.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- `gildata-provider/gildata.plugin.json`
```json
{
  "id": "gildata-provider",
  "name": "Gildata Provider",
  "version": "0.1.0",
  "description": "Integration with Gildata API for chat and image generation",
  "entry": "./dist/index.js",
  "apiVersion": "1.0.0",
  "capabilities": [
    "chat",
    "image-generation"
  ],
  "auth": {
    "type": "oauth",
    "oauth": {
      "authUrl": "https://gildata.com/oauth/authorize",
      "tokenUrl": "https://gildata.com/oauth/token",
      "scopes": ["chat", "image"]
    }
  }
}
```

#### 任务1.2：TypeScript配置
- **目标**: 设置TypeScript环境
- **步骤**:
  1. 创建tsconfig.json
  2. 设置编译选项
  3. 配置模块解析

**文件修改**:
- `gildata-provider/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 阶段2：核心客户端

#### 任务2.1：API客户端基础
- **目标**: 实现HTTP客户端基础
- **步骤**:
  1. 创建基础HTTP客户端类
  2. 实现请求拦截器
  3. 添加错误处理
  4. 实现重试机制

**文件修改**:
- `gildata-provider/src/client/gildata.client.ts`
```typescript
import { Agent } from 'undici';
import { z } from 'zod';

export interface GildataConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryCount?: number;
}

export interface GildataResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
  };
}

export class GildataClient {
  private config: Required<GildataConfig>;
  private agent: Agent;

  constructor(config: GildataConfig = {}) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.gildata.com',
      timeout: config.timeout || 30000,
      retryCount: config.retryCount || 3,
    };
    this.agent = new Agent();
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<GildataResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...options.headers,
        },
        signal: AbortSignal.timeout(this.config.timeout),
        dispatcher: this.agent,
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: data.message || 'Request failed',
            details: data,
          },
          metadata: {
            requestId: this.generateRequestId(),
            timestamp: new Date().toISOString(),
            duration,
          },
        };
      }

      return {
        success: true,
        data: data as T,
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: new Date().toISOString(),
          duration,
        },
      };
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 任务2.2：类型定义
- **目标**: 定义所有必要的类型
- **步骤**:
  1. 创建API响应类型
  2. 定义模型类型
  3. 创建认证类型
  4. 实现验证模式

**文件修改**:
- `gildata-provider/src/client/types.ts`
```typescript
import { z } from 'zod';

// 模型类型
export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['chat', 'image']),
  capabilities: z.array(z.string()),
  pricing: z.object({
    input: z.number(),
    output: z.number(),
  }),
  maxTokens: z.number().optional(),
  supportsStreaming: z.boolean().default(false),
  supportsImages: z.boolean().default(false),
});

export type Model = z.infer<typeof ModelSchema>;

// 聊天消息类型
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  name: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// 聊天请求类型
export const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(ChatMessageSchema),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().optional(),
  stream: z.boolean().default(false),
  stop: z.array(z.string()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// 聊天响应类型
export const ChatResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: ChatMessageSchema,
    finishReason: z.enum(['stop', 'length', 'content_filter']),
  })),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// 图像生成请求类型
export const ImageRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  size: z.enum(['256x256', '512x512', '1024x1024']).default('512x512'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.string().optional(),
  steps: z.number().min(1).max(50).default(20),
});

export type ImageRequest = z.infer<typeof ImageRequestSchema>;

// 图像响应类型
export const ImageResponseSchema = z.object({
  id: z.string(),
  object: z.literal('image'),
  created: z.number(),
  data: z.array(z.object({
    url: z.string(),
    revised_prompt: z.string().optional(),
  })),
});

export type ImageResponse = z.infer<typeof ImageResponseSchema>;

// 认证类型
export const AuthConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('Bearer'),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
```

#### 任务2.3：认证模块
- **目标**: 实现OAuth2认证
- **步骤**:
  1. 实现授权码流程
  2. 添加令牌刷新
  3. 实现令牌验证
  4. 添加缓存机制

**文件修改**:
- `gildata-provider/src/client/auth.ts`
```typescript
import { GildataClient } from './gildata.client.js';
import { AuthConfig, TokenResponse } from './types.js';
import { z } from 'zod';

export class GildataAuth {
  private client: GildataClient;
  private config: Required<AuthConfig>;
  private tokenCache: Map<string, { token: TokenResponse; expiresAt: number }>;

  constructor(config: AuthConfig, client?: GildataClient) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: config.scopes || ['chat', 'image'],
    };
    this.client = client || new GildataClient();
    this.tokenCache = new Map();
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: this.generateCodeChallenge(),
    });
    return `https://gildata.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, codeVerifier: string): Promise<TokenResponse> {
    const response = await this.client.request<TokenResponse>('/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(`Token exchange failed: ${response.error?.message}`);
    }

    return response.data;
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const cacheKey = `refresh_${refreshToken}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    const response = await this.client.request<TokenResponse>('/oauth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(`Token refresh failed: ${response.error?.message}`);
    }

    const token = response.data;
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + (token.expires_in - 300) * 1000, // 5分钟缓冲
    });

    return token;
  }

  async getValidToken(forceRefresh = false): Promise<string> {
    // 这里简化处理，实际应该从存储中获取现有令牌
    // 实现应包括令牌过期检查和刷新逻辑
    if (forceRefresh) {
      throw new Error('Implement token refresh logic');
    }
    
    // 临时返回，实际应该从缓存或存储获取
    return 'dummy-token';
  }

  private generateCodeChallenge(): string {
    // 实现 PKCE code challenge
    return 'dummy-challenge';
  }
}
```

### 阶段3：服务层实现

#### 任务3.1：聊天服务
- **目标**: 实现聊天功能
- **步骤**:
  1. 创建聊天服务类
  2. 实现流式和非流式响应
  3. 添加消息历史管理
  4. 实现使用追踪

**文件修改**:
- `gildata-provider/src/services/chat.service.ts`
```typescript
import { GildataClient } from '../client/gildata.client.js';
import { ChatRequest, ChatResponse, ChatMessage } from '../client/types.js';
import { z } from 'zod';

export class ChatService {
  private client: GildataClient;
  private usageTracker: UsageTracker;

  constructor(client: GildataClient) {
    this.client = client;
    this.usageTracker = new UsageTracker();
  }

  async createChat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.request<ChatResponse>('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.success || !response.data) {
      throw new Error(`Chat request failed: ${response.error?.message}`);
    }

    // 记录使用情况
    if (response.data.usage) {
      this.usageTracker.recordChatUsage(
        request.model,
        response.data.usage.promptTokens,
        response.data.usage.completionTokens
      );
    }

    return response.data;
  }

  async createChatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const streamRequest = { ...request, stream: true };
    
    const response = await fetch(`${this.client['config'].baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.client['config'].apiKey}`,
      },
      body: JSON.stringify(streamRequest),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get stream reader');
    }

    let fullResponse: Partial<ChatResponse> = {
      id: '',
      object: 'chat.completion',
      created: Date.now(),
      model: request.model,
      choices: [],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              if (fullResponse.usage) {
                this.usageTracker.recordChatUsage(
                  request.model,
                  fullResponse.usage.promptTokens,
                  fullResponse.usage.completionTokens
                );
              }
              return fullResponse as ChatResponse;
            }

            try {
              const chunk = JSON.parse(data);
              if (chunk.choices?.[0]?.delta?.content) {
                onChunk(chunk.choices[0].delta.content);
                fullResponse.choices!.push({
                  index: 0,
                  message: { role: 'assistant', content: chunk.choices[0].delta.content },
                  finishReason: chunk.choices[0].finishReason,
                });
              }
              if (chunk.usage) {
                fullResponse.usage = {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                };
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    throw new Error('Stream ended without [DONE]');
  }

  async getChatHistory(conversationId: string): Promise<ChatMessage[]> {
    // 实现聊天历史获取
    const response = await this.client.request<ChatMessage[]>(`/chat/history/${conversationId}`);
    if (!response.success || !response.data) {
      throw new Error(`Failed to get chat history: ${response.error?.message}`);
    }
    return response.data;
  }
}

class UsageTracker {
  private usage = new Map<string, {
    promptTokens: number;
    completionTokens: number;
    requests: number;
  }>();

  recordChatUsage(model: string, promptTokens: number, completionTokens: number) {
    const existing = this.usage.get(model) || {
      promptTokens: 0,
      completionTokens: 0,
      requests: 0,
    };

    existing.promptTokens += promptTokens;
    existing.completionTokens += completionTokens;
    existing.requests += 1;

    this.usage.set(model, existing);
  }

  getUsage(model?: string) {
    if (model) {
      return this.usage.get(model);
    }
    return Object.fromEntries(this.usage);
  }
}
```

#### 任务3.2：图像生成服务
- **目标**: 实现图像生成功能
- **步骤**:
  1. 创建图像生成服务
  2. 实现多种尺寸和质量选项
  3. 添加风格控制
  4. 实现异步生成和轮询

**文件修改**:
- `gildata-provider/src/services/image.service.ts`
```typescript
import { GildataClient } from '../client/gildata.client.js';
import { ImageRequest, ImageResponse } from '../client/types.js';
import { z } from 'zod';

export class ImageService {
  private client: GildataClient;
  private usageTracker: UsageTracker;

  constructor(client: GildataClient) {
    this.client = client;
    this.usageTracker = new UsageTracker();
  }

  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    const response = await this.client.request<ImageResponse>('/images/generations', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.success || !response.data) {
      throw new Error(`Image generation failed: ${response.error?.message}`);
    }

    // 记录使用情况
    this.usageTracker.recordImageUsage(request.model, request.steps);

    return response.data;
  }

  async generateImageAsync(
    request: ImageRequest,
    callback?: (status: string, progress?: number) => void
  ): Promise<{ id: string; status: string }> {
    const response = await this.client.request<{ id: string; status: string }>(
      '/images/generations/async',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(`Async image generation failed: ${response.error?.message}`);
    }

    if (callback) {
      callback(response.data.status);
    }

    return response.data;
  }

  async getGenerationStatus(id: string): Promise<{ id: string; status: string; progress?: number }> {
    const response = await this.client.request<{ id: string; status: string; progress?: number }>(
      `/images/generations/${id}/status`
    );

    if (!response.success || !response.data) {
      throw new Error(`Failed to get generation status: ${response.error?.message}`);
    }

    return response.data;
  }

  async getGeneratedImage(id: string): Promise<ImageResponse> {
    const response = await this.client.request<ImageResponse>(`/images/generations/${id}/result`);

    if (!response.success || !response.data) {
      throw new Error(`Failed to get generated image: ${response.error?.message}`);
    }

    return response.data;
  }

  async getAvailableStyles(): Promise<Array<{ id: string; name: string; description: string }>> {
    const response = await this.client.request<Array<{ id: string; name: string; description: string }>>(
      '/images/styles'
    );

    if (!response.success || !response.data) {
      throw new Error(`Failed to get image styles: ${response.error?.message}`);
    }

    return response.data;
  }
}

class UsageTracker {
  private imageUsage = new Map<string, {
    generations: number;
    totalSteps: number;
  }>();

  recordImageUsage(model: string, steps: number) {
    const existing = this.imageUsage.get(model) || {
      generations: 0,
      totalSteps: 0,
    };

    existing.generations += 1;
    existing.totalSteps += steps;

    this.imageUsage.set(model, existing);
  }

  getImageUsage(model?: string) {
    if (model) {
      return this.imageUsage.get(model);
    }
    return Object.fromEntries(this.imageUsage);
  }
}
```

#### 任务3.3：模型目录服务
- **目标**: 实现模型管理
- **步骤**:
  1. 获取可用模型列表
  2. 实现模型详情查询
  3. 添加模型比较功能
  4. 实现模型能力检查

**文件修改**:
- `gildata-provider/src/services/catalog.service.ts`
```typescript
import { GildataClient } from '../client/gildata.client.js';
import { Model } from '../client/types.js';
import { z } from 'zod';

export class CatalogService {
  private client: GildataClient;
  private modelCache: { models: Model[]; timestamp: number };
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

  constructor(client: GildataClient) {
    this.client = client;
    this.modelCache = { models: [], timestamp: 0 };
  }

  async getModels(): Promise<Model[]> {
    const now = Date.now();
    if (this.modelCache.models.length > 0 && now - this.modelCache.timestamp < this.CACHE_TTL) {
      return this.modelCache.models;
    }

    const response = await this.client.request<Model[]>('/models');
    if (!response.success || !response.data) {
      throw new Error(`Failed to get models: ${response.error?.message}`);
    }

    this.modelCache = {
      models: response.data,
      timestamp: now,
    };

    return response.data;
  }

  async getModel(id: string): Promise<Model> {
    const models = await this.getModels();
    const model = models.find(m => m.id === id);
    
    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    return model;
  }

  async getModelsByType(type: 'chat' | 'image'): Promise<Model[]> {
    const models = await this.getModels();
    return models.filter(m => m.type === type);
  }

  async getChatModels(): Promise<Model[]> {
    return this.getModelsByType('chat');
  }

  async getImageModels(): Promise<Model[]> {
    return this.getModelsByType('image');
  }

  async compareModels(modelIds: string[]): Promise<Model[]> {
    const models = await this.getModels();
    return models.filter(m => modelIds.includes(m.id));
  }

  async searchModels(query: string): Promise<Model[]> {
    const models = await this.getModels();
    const lowerQuery = query.toLowerCase();
    
    return models.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.capabilities.some(cap => cap.toLowerCase().includes(lowerQuery))
    );
  }

  async getModelPricing(modelId: string): Promise<{
    input: number;
    output: number;
    currency: string;
  }> {
    const model = await this.getModel(modelId);
    return {
      input: model.pricing.input,
      output: model.pricing.output,
      currency: 'USD', // 根据实际情况调整
    };
  }

  clearCache(): void {
    this.modelCache = { models: [], timestamp: 0 };
  }
}
```

#### 任务3.4：使用追踪服务
- **目标**: 实现使用统计
- **步骤**:
  1. 创建使用追踪器
  2. 实现日志记录
  3. 添加使用报告
  4. 实现限额检查

**文件修改**:
- `gildata-provider/src/services/usage.service.ts`
```typescript
import { Model } from '../client/types.js';

export interface UsageLimit {
  model: string;
  requestsPerMinute: number;
  tokensPerMinute: number;
  imagesPerMinute: number;
}

export interface UsageStats {
  period: string;
  model: string;
  requests: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  images: number;
  cost: number;
}

export class UsageService {
  private usageStats: Map<string, UsageStats>;
  private limits: Map<string, UsageLimit>;
  private rateLimitTrackers: Map<string, {
    requests: number;
    tokens: number;
    images: number;
    resetTime: number;
  }>;

  constructor() {
    this.usageStats = new Map();
    this.limits = new Map();
    this.rateLimitTrackers = new Map();
  }

  setLimits(model: string, limits: UsageLimit): void {
    this.limits.set(model, limits);
  }

  async checkRateLimit(model: string): Promise<{ allowed: boolean; remaining?: number; resetAt?: number }> {
    const limit = this.limits.get(model);
    if (!limit) {
      return { allowed: true };
    }

    const now = Date.now();
    const tracker = this.rateLimitTrackers.get(model) || {
      requests: 0,
      tokens: 0,
      images: 0,
      resetTime: now + 60 * 1000, // 1分钟后重置
    };

    // 重置过期的追踪器
    if (now >= tracker.resetTime) {
      tracker.requests = 0;
      tracker.tokens = 0;
      tracker.images = 0;
      tracker.resetTime = now + 60 * 1000;
    }

    // 检查请求限制
    if (tracker.requests >= limit.requestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: tracker.resetTime,
      };
    }

    // 检查令牌限制
    if (tracker.tokens >= limit.tokensPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: tracker.resetTime,
      };
    }

    // 检查图像限制
    if (tracker.images >= limit.imagesPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: tracker.resetTime,
      };
    }

    return { allowed: true };
  }

  async recordChatUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
    const stats = this.getPeriodStats(model);
    stats.requests++;
    stats.tokens.input += inputTokens;
    stats.tokens.output += outputTokens;
    stats.tokens.total += inputTokens + outputTokens;
    
    // 更新速率限制追踪
    this.updateRateLimitTracker(model, 'requests', 1);
    this.updateRateLimitTracker(model, 'tokens', inputTokens + outputTokens);

    // 计算成本（简化计算）
    const modelPrice = await this.getModelPrice(model);
    stats.cost += (inputTokens * modelPrice.input + outputTokens * modelPrice.output) / 1000;
  }

  async recordImageUsage(model: string, steps: number): Promise<void> {
    const stats = this.getPeriodStats(model);
    stats.images++;
    
    // 更新速率限制追踪
    this.updateRateLimitTracker(model, 'images', 1);

    // 计算成本
    const modelPrice = await this.getModelPrice(model);
    stats.cost += modelPrice.output; // 假设固定价格
  }

  getUsageReport(model?: string): UsageStats[] {
    if (model) {
      const stats = this.usageStats.get(model);
      return stats ? [stats] : [];
    }
    
    return Array.from(this.usageStats.values());
  }

  getPeriodStats(model: string): UsageStats {
    const period = this.getCurrentPeriod();
    const key = `${model}:${period}`;
    
    if (!this.usageStats.has(key)) {
      this.usageStats.set(key, {
        period,
        model,
        requests: 0,
        tokens: { input: 0, output: 0, total: 0 },
        images: 0,
        cost: 0,
      });
    }
    
    return this.usageStats.get(key)!;
  }

  private updateRateLimitTracker(model: string, type: 'requests' | 'tokens' | 'images', amount: number): void {
    let tracker = this.rateLimitTrackers.get(model);
    if (!tracker) {
      tracker = {
        requests: 0,
        tokens: 0,
        images: 0,
        resetTime: Date.now() + 60 * 1000,
      };
    }

    tracker[type] += amount;
    this.rateLimitTrackers.set(model, tracker);
  }

  private async getModelPrice(model: string): Promise<{ input: number; output: number }> {
    // 实际应该从API获取或配置中读取
    return {
      input: 0.001, // $0.001 per 1K tokens
      output: 0.002, // $0.002 per 1K tokens
    };
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }
}
```

### 阶段4：插件集成

#### 任务4.1：聊天钩子
- **目标**: 实现聊天功能集成
- **步骤**:
  1. 创建聊天钩子实现
  2. 注册模型
  3. 处理请求验证
  4. 实现错误处理

**文件修改**:
- `gildata-provider/src/hooks/chat.hook.ts`
```typescript
import { Hook } from '@openclaw/plugin-sdk';
import { ChatService } from '../services/chat.service.js';
import { CatalogService } from '../services/catalog.service.js';
import { UsageService } from '../services/usage.service.js';
import { ChatRequest, ChatResponse, Model } from '../client/types.js';
import { z } from 'zod';

export class ChatHook implements Hook {
  private chatService: ChatService;
  private catalogService: CatalogService;
  private usageService: UsageService;

  constructor(
    chatService: ChatService,
    catalogService: CatalogService,
    usageService: UsageService
  ) {
    this.chatService = chatService;
    this.catalogService = catalogService;
    this.usageService = usageService;
  }

  async execute(request: unknown): Promise<ChatResponse> {
    // 验证请求
    const validatedRequest = ChatRequestSchema.parse(request);
    
    // 检查模型是否可用
    const model = await this.catalogService.getModel(validatedRequest.model);
    if (model.type !== 'chat') {
      throw new Error(`Model ${validatedRequest.model} does not support chat`);
    }

    // 检查速率限制
    const rateLimitCheck = await this.usageService.checkRateLimit(validatedRequest.model);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded. Please try again later.`);
    }

    // 执行聊天请求
    const result = await this.chatService.createChat(validatedRequest);
    
    return result;
  }

  async getModels(): Promise<Model[]> {
    return await this.catalogService.getChatModels();
  }

  async getModelCapabilities(model: string): Promise<string[]> {
    const model = await this.catalogService.getModel(model);
    return model.capabilities;
  }
}

// 导出钩子
export const chatHook = new ChatHook(
  new ChatService(new GildataClient()),
  new CatalogService(new GildataClient()),
  new UsageService()
);
```

#### 任务4.2：图像生成钩子
- **目标**: 实现图像生成集成
- **步骤**:
  1. 创建图像钩子实现
  2. 注册图像模型
  3. 处理异步生成
  4. 实现进度通知

**文件修改**:
- `gildata-provider/src/hooks/image.hook.ts`
```typescript
import { Hook } from '@openclaw/plugin-sdk';
import { ImageService } from '../services/image.service.js';
import { CatalogService } from '../services/catalog.service.js';
import { UsageService } from '../services/usage.service.js';
import { ImageRequest, ImageResponse, Model } from '../client/types.js';
import { z } from 'zod';

export class ImageHook implements Hook {
  private imageService: ImageService;
  private catalogService: CatalogService;
  private usageService: UsageService;

  constructor(
    imageService: ImageService,
    catalogService: CatalogService,
    usageService: UsageService
  ) {
    this.imageService = imageService;
    this.catalogService = catalogService;
    this.usageService = usageService;
  }

  async execute(request: unknown): Promise<ImageResponse> {
    // 验证请求
    const validatedRequest = ImageRequestSchema.parse(request);
    
    // 检查模型是否可用
    const model = await this.catalogService.getModel(validatedRequest.model);
    if (model.type !== 'image') {
      throw new Error(`Model ${validatedRequest.model} does not support image generation`);
    }

    // 检查速率限制
    const rateLimitCheck = await this.usageService.checkRateLimit(validatedRequest.model);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded. Please try again later.`);
    }

    // 执行图像生成
    return await this.imageService.generateImage(validatedRequest);
  }

  async asyncGenerate(
    request: unknown,
    callback?: (status: string, progress?: number) => void
  ): Promise<{ id: string; status: string }> {
    const validatedRequest = ImageRequestSchema.parse(request);
    
    const model = await this.catalogService.getModel(validatedRequest.model);
    if (model.type !== 'image') {
      throw new Error(`Model ${validatedRequest.model} does not support image generation`);
    }

    return await this.imageService.generateImageAsync(validatedRequest, callback);
  }

  async getGenerationStatus(id: string): Promise<{ id: string; status: string; progress?: number }> {
    return await this.imageService.getGenerationStatus(id);
  }

  async getResult(id: string): Promise<ImageResponse> {
    return await this.imageService.getGeneratedImage(id);
  }

  async getModels(): Promise<Model[]> {
    return await this.catalogService.getImageModels();
  }

  async getStyles(): Promise<Array<{ id: string; name: string; description: string }>> {
    return await this.imageService.getAvailableStyles();
  }
}

// 导出钩子
export const imageHook = new ImageHook(
  new ImageService(new GildataClient()),
  new CatalogService(new GildataClient()),
  new UsageService()
);
```

#### 任务4.3：健康检查钩子
- **目标**: 实现服务健康检查
- **步骤**:
  1. 创建健康检查服务
  2. 添加状态端点
  3. 实现依赖检查
  4. 添加性能监控

**文件修改**:
- `gildata-provider/src/hooks/health.hook.ts`
```typescript
import { Hook } from '@openclaw/plugin-sdk';
import { GildataClient } from '../client/gildata.client.js';
import { z } from 'zod';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    api: boolean;
    auth: boolean;
    models: boolean;
  };
  metrics?: {
    uptime: number;
    requests: number;
    errors: number;
    latency: {
      average: number;
      p95: number;
      p99: number;
    };
  };
}

export class HealthHook implements Hook {
  private client: GildataClient;
  private startTime: number;
  private metrics = {
    requests: 0,
    errors: 0,
    latencies: [] as number[],
  };

  constructor(client: GildataClient) {
    this.client = client;
    this.startTime = Date.now();
  }

  async execute(request?: { service?: string }): Promise<HealthStatus> {
    this.metrics.requests++;

    try {
      const status = await this.checkServices(request?.service);
      const metrics = this.calculateMetrics();
      
      return {
        status: status.overall,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        services: status.services,
        metrics: metrics,
      };
    } catch (error) {
      this.metrics.errors++;
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        services: {
          api: false,
          auth: false,
          models: false,
        },
      };
    }
  }

  private async checkServices(service?: string): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      api: boolean;
      auth: boolean;
      models: boolean;
    };
  }> {
    const services = {
      api: false,
      auth: false,
      models: false,
    };

    let healthyCount = 0;

    // API健康检查
    if (!service || service === 'api') {
      try {
        const response = await this.client.request('/health');
        services.api = response.success;
        if (services.api) healthyCount++;
      } catch {
        services.api = false;
      }
    }

    // 认证健康检查
    if (!service || service === 'auth') {
      try {
        // 模拟检查令端
        const response = await this.client.request('/oauth/validate');
        services.auth = response.success;
        if (services.auth) healthyCount++;
      } catch {
        services.auth = false;
      }
    }

    // 模型服务健康检查
    if (!service || service === 'models') {
      try {
        const response = await this.client.request('/models');
        services.models = response.success;
        if (services.models) healthyCount++;
      } catch {
        services.models = false;
      }
    }

    const overall = healthyCount === 3 ? 'healthy' : 
                   healthyCount > 0 ? 'degraded' : 'unhealthy';

    return { overall, services };
  }

  private calculateMetrics(): {
    uptime: number;
    requests: number;
    errors: number;
    latency: {
      average: number;
      p95: number;
      p99: number;
    };
  } {
    const latencies = this.metrics.latencies;
    const average = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

    return {
      uptime: Date.now() - this.startTime,
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      latency: {
        average,
        p95,
        p99,
      },
    };
  }

  recordLatency(latency: number): void {
    this.metrics.latencies.push(latency);
    // 保留最近1000个延迟数据点
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies = this.metrics.latencies.slice(-1000);
    }
  }
}

// 导出钩子
export const healthHook = new HealthHook(new GildataClient());
```

#### 任务4.4：主入口文件
- **目标**: 集成所有功能
- **步骤**:
  1. 创建主入口点
  2. 注册所有钩子
  3. 配置插件选项
  4. 导出公共API

**文件修改**:
- `gildata-provider/src/index.ts`
```typescript
import { Plugin, PluginConfig } from '@openclaw/plugin-sdk';
import { GildataClient } from './client/gildata.client.js';
import { GildataAuth } from './client/auth.js';
import { ChatService } from './services/chat.service.js';
import { ImageService } from './services/image.service.js';
import { CatalogService } from './services/catalog.service.js';
import { UsageService } from './services/usage.service.js';
import { chatHook } from './hooks/chat.hook.js';
import { imageHook } from './hooks/image.hook.js';
import { healthHook } from './hooks/health.hook.js';
import { z } from 'zod';

export const GildataProviderPluginConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  authConfig: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string().url(),
    scopes: z.array(z.string()),
  }).optional(),
  usageLimits: z.record(z.string(), z.object({
    requestsPerMinute: z.number().positive(),
    tokensPerMinute: z.number().positive(),
    imagesPerMinute: z.number().positive(),
  })).optional(),
});

export type GildataProviderPluginConfig = z.infer<typeof GildataProviderPluginConfigSchema>;

export class GildataProviderPlugin implements Plugin {
  private config: Required<GildataProviderPluginConfig>;
  private client: GildataClient;
  private auth?: GildataAuth;
  private chatService: ChatService;
  private imageService: ImageService;
  private catalogService: CatalogService;
  private usageService: UsageService;

  constructor(config: GildataProviderPluginConfig) {
    this.config = {
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl || 'https://api.gildata.com',
      authConfig: config.authConfig,
      usageLimits: config.usageLimits || {},
    };

    this.client = new GildataClient({
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
    });

    // 初始化服务
    this.chatService = new ChatService(this.client);
    this.imageService = new ImageService(this.client);
    this.catalogService = new CatalogService(this.client);
    this.usageService = new UsageService();

    // 设置使用限制
    if (this.config.usageLimits) {
      for (const [model, limits] of Object.entries(this.config.usageLimits)) {
        this.usageService.setLimits(model, limits);
      }
    }

    // 如果有认证配置，初始化认证服务
    if (this.config.authConfig) {
      this.auth = new GildataAuth(this.config.authConfig, this.client);
    }
  }

  get id(): string {
    return 'gildata-provider';
  }

  get name(): string {
    return 'Gildata Provider';
  }

  get version(): string {
    return '0.1.0';
  }

  async initialize(): Promise<void> {
    // 初始化插件
    console.log('Initializing Gildata Provider...');
    
    // 验证配置
    try {
      await this.catalogService.getModels();
    } catch (error) {
      throw new Error(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async destroy(): Promise<void> {
    // 清理资源
    this.catalogService.clearCache();
  }

  // 获取聊天钩子
  get chat() {
    return chatHook;
  }

  // 获取图像钩子
  get image() {
    return imageHook;
  }

  // 获取健康检查钩子
  get health() {
    return healthHook;
  }

  // 获取认证客户端
  get authClient(): GildataAuth | undefined {
    return this.auth;
  }

  // 获取目录服务
  get catalog(): CatalogService {
    return this.catalogService;
  }

  // 获取使用服务
  get usage(): UsageService {
    return this.usageService;
  }
}

// 创建插件工厂函数
export function createGildataProvider(
  config: GildataProviderPluginConfig
): GildataProviderPlugin {
  return new GildataProviderPlugin(config);
}

// 默认导出
export default createGildataProvider;
```

### 阶段5：测试实现

#### 任务5.1：单元测试
- **目标**: 为核心功能编写测试
- **步骤**:
  1. 客户端测试
  2. 服务测试
  3. 认证测试
  4. 钩子测试

**文件修改**:
- `gildata-provider/tests/unit/client.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GildataClient } from '../../src/client/gildata.client.js';
import { GildataResponse } from '../../src/client/gildata.client.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GildataClient', () => {
  let client: GildataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GildataClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
    });
  });

  describe('request', () => {
    it('should make a successful request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const response = await client.request('/test');

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ data: 'test' });
      expect(response.metadata).toBeDefined();
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad request' }),
      });

      const response = await client.request('/test');

      expect(response.success).toBe(false);
      expect(response.error).toEqual({
        code: 'HTTP_400',
        message: 'Bad request',
      });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const response = await client.request('/test');

      expect(response.success).toBe(false);
      expect(response.error).toEqual({
        code: 'REQUEST_ERROR',
        message: 'Network error',
      });
    });
  });
});
```

- `gildata-provider/tests/unit/chat.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatService } from '../../src/services/chat.service.js';
import { GildataClient } from '../../src/client/gildata.client.js';
import { ChatRequest } from '../../src/client/types.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ChatService', () => {
  let chatService: ChatService;
  let mockClient: GildataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new GildataClient({ apiKey: 'test' });
    chatService = new ChatService(mockClient);
  });

  describe('createChat', () => {
    it('should create a chat completion', async () => {
      const request: ChatRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'chat-123',
          object: 'chat.completion',
          created: Date.now(),
          model: 'test-model',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Hi there!' },
            finishReason: 'stop',
          }],
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        }),
      });

      const response = await chatService.createChat(request);

      expect(response.id).toBe('chat-123');
      expect(response.choices[0].message.content).toBe('Hi there!');
      expect(response.usage?.totalTokens).toBe(15);
    });

    it('should handle API errors', async () => {
      const request: ChatRequest = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(chatService.createChat(request)).rejects.toThrow(
        'Chat request failed: Server error'
      );
    });
  });
});
```

#### 任务5.2：集成测试
- **目标**: 测试完整工作流
- **步骤**:
  1. API集成测试
  2. 认证流程测试
  3. 多服务交互测试
  4. 错误处理测试

**文件修改**:
- `gildata-provider/tests/integration/api.test.ts`
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GildataProviderPlugin } from '../../src/index.js';

describe('Gildata Provider Integration', () => {
  let plugin: GildataProviderPlugin;

  beforeAll(async () => {
    plugin = new GildataProviderPlugin({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    });

    await plugin.initialize();
  });

  afterAll(async () => {
    await plugin.destroy();
  });

  it('should get chat models', async () => {
    const models = await plugin.chat.getModels();
    
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('type');
  });

  it('should get image models', async () => {
    const models = await plugin.image.getModels();
    
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty('id');
    expect(models[0]).toHaveProperty('name');
    expect(models[0]).toHaveProperty('type');
  });

  it('should check health status', async () => {
    const health = await plugin.health.execute();
    
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('services');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
  });

  it('should handle rate limiting', async () => {
    // 测试速率限制功能
    const usageService = plugin.usage;
    await usageService.setLimits('test-model', {
      requestsPerMinute: 1,
      tokensPerMinute: 100,
      imagesPerMinute: 1,
    });

    const firstCheck = await usageService.checkRateLimit('test-model');
    expect(firstCheck.allowed).toBe(true);

    // 模拟使用
    await usageService.recordChatUsage('test-model', 10, 10);

    const secondCheck = await usageService.checkRateLimit('test-model');
    // 第二次检查应该仍然允许，因为我们只使用了1个请求中的1个
    expect(secondCheck.allowed).toBe(true);
  });
});
```

### 阶段6：文档和示例

#### 任务6.1：README文档
- **目标**: 编写使用文档
- **步骤**:
  1. 安装说明
  2. 配置指南
  3. API使用示例
  4. 故障排除

**文件修改**:
- `gildata-provider/README.md`
```markdown
# Gildata Provider for OpenClaw

Gildata Provider 是 OpenClaw 的官方提供商插件，提供了与 Gildata API 的完整集成。

## 功能特性

- 🎯 聊天对话
- 🖼️ 图像生成
- 📊 使用追踪
- 🔐 OAuth2 认证
- 🚀 流式响应
- ⚡ 速率限制

## 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 运行测试
npm test
```

## 配置

### 基本配置

```javascript
import { createGildataProvider } from '@openclaw/gildata-provider';

const provider = createGildataProvider({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.gildata.com',
});
```

### 认证配置

```javascript
const provider = createGildataProvider({
  authConfig: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    redirectUri: 'https://your-app.com/callback',
    scopes: ['chat', 'image'],
  },
});
```

### 使用限制配置

```javascript
const provider = createGildataProvider({
  usageLimits: {
    'gpt-3.5-turbo': {
      requestsPerMinute: 60,
      tokensPerMinute: 40000,
      imagesPerMinute: 10,
    },
  },
});
```

## 使用示例

### 聊天对话

```javascript
// 获取可用模型
const models = await provider.chat.getModels();

// 发送聊天请求
const response = await provider.chat.execute({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'user', content: 'Hello, how are you?' },
  ],
});

console.log(response.choices[0].message.content);
```

### 流式响应

```javascript
const stream = await provider.chat.execute(
  {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true,
  },
  (chunk) => {
    console.log(chunk);
  }
);
```

### 图像生成

```javascript
// 生成图像
const imageResponse = await provider.image.execute({
  model: 'dall-e-3',
  prompt: 'A beautiful sunset',
  size: '1024x1024',
});

console.log(imageResponse.data[0].url);
```

### 异步图像生成

```javascript
// 启动异步生成
const { id } = await provider.image.asyncGenerate(
  {
    model: 'dall-e-3',
    prompt: 'A cat sitting on a windowsill',
  },
  (status, progress) => {
    console.log(`Status: ${status}, Progress: ${progress}%`);
  }
);

// 获取生成状态
const status = await provider.image.getGenerationStatus(id);

// 获取最终结果
const result = await provider.image.getResult(id);
```

### 健康检查

```javascript
// 检查整体健康状态
const health = await provider.health.execute();
console.log(`Status: ${health.status}`);

// 检查特定服务
const apiHealth = await provider.health.execute({ service: 'api' });
```

## API 参考

### Chat Service

| 方法 | 描述 |
|------|------|
| `execute(request)` | 执行聊天请求 |
| `getModels()` | 获取聊天模型列表 |

### Image Service

| 方法 | 描述 |
|------|------|
| `execute(request)` | 生成图像 |
| `asyncGenerate(request, callback)` | 异步生成图像 |
| `getGenerationStatus(id)` | 获取生成状态 |
| `getResult(id)` | 获取生成结果 |
| `getModels()` | 获取图像模型列表 |

### Health Service

| 方法 | 描述 |
|------|------|
| `execute(optionalService)` | 检查健康状态 |

## 故障排除

### 常见错误

#### API 认证失败
```
Error: Invalid API key
```
检查 API 密钥是否正确配置。

#### 速率限制
```
Error: Rate limit exceeded
```
减少请求频率或提高使用限制。

#### 模型不可用
```
Error: Model not found
```
检查模型 ID 是否正确，或使用 `getModels()` 获取可用模型。

### 调试

启用调试日志：
```javascript
const provider = createGildataProvider({
  apiKey: 'your-api-key',
  debug: true,
});
```

## 许可证

MIT License
```

#### 任务6.2：使用示例
- **目标**: 提供代码示例
- **步骤**:
  1. 基础用法
  2. 高级功能
  3. 错误处理
  4. 性能优化

**文件修改**:
- `gildata-provider/examples/basic-usage.js`
```javascript
import { createGildataProvider } from '../src/index.js';

// 创建提供商实例
const provider = createGildataProvider({
  apiKey: process.env.GILDATA_API_KEY,
  baseUrl: 'https://api.gildata.com',
});

// 初始化
await provider.initialize();

// 聊天示例
async function chatExample() {
  try {
    const response = await provider.chat.execute({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Explain quantum computing in simple terms.' },
      ],
      temperature: 0.7,
      maxTokens: 150,
    });

    console.log('Assistant:', response.choices[0].message.content);
    console.log('Tokens used:', response.usage.totalTokens);
  } catch (error) {
    console.error('Chat error:', error.message);
  }
}

// 图像生成示例
async function imageExample() {
  try {
    const response = await provider.image.execute({
      model: 'dall-e-3',
      prompt: 'A futuristic cityscape at sunset',
      size: '1024x1024',
    });

    console.log('Image URL:', response.data[0].url);
  } catch (error) {
    console.error('Image error:', error.message);
  }
}

// 运行示例
async function main() {
  await chatExample();
  await imageExample();
  
  // 清理
  await provider.destroy();
}

main().catch(console.error);
```

## 4. 测试策略

### 4.1 测试覆盖范围
- **单元测试**：80% 覆盖率
  - 客户端功能
  - 服务层逻辑
  - 错误处理
  - 类型验证

- **集成测试**：
  - API 端点测试
  - 认证流程测试
  - 服务间交互
  - 数据一致性

- **端到端测试**：
  - 完整工作流
  - 错误恢复
  - 性能基准

### 4.2 测试框架
- **Vitest**：单元测试
- **Playwright**：E2E测试（可选）
- **MSW**：API模拟

### 4.3 测试数据
使用固定的测试数据集：
```typescript
// tests/fixtures/responses/chat-success.json
{
  "id": "chat-123",
  "object": "chat.completion",
  "created": 1640995200,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
```

## 5. 部署和发布

### 5.1 构建流程
```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "oxlint .",
    "format": "oxfmt --write",
    "prepublish": "npm run test && npm run lint && npm run build"
  }
}
```

### 5.2 版本管理
- 语义化版本控制
- 变更日志维护
- 自动发布流程

## 6. 自检清单

### 6.1 功能实现检查
- [ ] 所有API端点已实现
- [ ] 错误处理完整
- [ ] 类型定义准确
- [ ] 认证流程完整
- [ ] 使用追踪功能
- [ ] 速率限制功能

### 6.2 代码质量检查
- [ ] 所有代码通过TypeScript检查
- [ ] 单元测试覆盖率≥80%
- [ ] 代码格式正确
- [ ] 无ESLint警告
- [ ] 无循环依赖
- [ ] 无未导出类型

### 6.3 性能检查
- [ ] 响应时间符合要求
- [ ] 内存使用合理
- [ ] 无内存泄漏
- [ ] 缓存策略有效
- [ ] 并发处理正确

### 6.4 文档检查
- [ ] README完整
- [ ] API文档准确
- [ ] 示例代码可运行
- [ ] 故障排除指南
- [ ] 更新日志

### 6.5 安全检查
- [ ] 无硬编码密钥
- [ ] 输入验证完整
- [ ] 错误信息不泄露敏感信息
- [ ] 认证流程安全
- [ ] 速率防止滥用

## 7. 风险和缓解措施

### 7.1 技术风险
- **API变更**：保持版本兼容性，提供迁移指南
- **性能问题**：实现缓存和限流
- **错误处理**：完善的错误恢复机制

### 7.2 业务风险
- **服务中断**：实现健康检查和重试机制
- **成本控制**：使用追踪和限制
- **用户体验**：友好的错误消息和进度反馈

## 8. 后续优化

### 8.1 短期优化
- 性能基准测试
- 错误率监控
- 用户反馈收集

### 8.2 长期规划
- 更多Gildata功能集成
- 高级特性（如函数调用）
- 多区域部署支持

## 9. 总结

本计划提供了Gildata提供商集成的完整实现方案，涵盖了从基础设置到高级功能的各个方面。通过遵循TDD原则和最佳实践，确保了代码质量、可维护性和可扩展性。实施此计划将帮助OpenClaw用户充分利用Gildata API的强大功能。