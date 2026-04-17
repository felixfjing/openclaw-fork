/**
 * warrenq缓存管理模块
 *
 * 功能：
 * - 缓存租户信息（TTL: 1小时）
 * - 缓存模型列表（TTL: 24小时）
 * - 提供缓存失效接口
 * - 缓存命中率统计
 * - 支持配置禁用缓存
 * - 不缓存敏感信息（token、密码）
 */

import type { warrenqTenantInfo } from "./warrenq-login.js";
import type { warrenqModelList } from "./types.js";

/**
 * 缓存项接口
 */
interface CacheItem<T> {
  /** 缓存的值 */
  value: T;
  /** 过期时间戳（毫秒） */
  expiresAt: number;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间戳（毫秒） */
  lastAccessedAt: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 租户信息TTL（毫秒），默认1小时 */
  tenantInfoTtl: number;
  /** 模型列表TTL（毫秒），默认24小时 */
  modelListTtl: number;
  /** 最大缓存项数 */
  maxCacheSize: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 总缓存项数 */
  totalItems: number;
  /** 缓存命中次数 */
  hitCount: number;
  /** 缓存未命中次数 */
  missCount: number;
  /** 缓存命中率 */
  hitRate: number;
  /** 租户信息缓存项数 */
  tenantInfoItems: number;
  /** 模型列表缓存项数 */
  modelListItems: number;
}

/**
 * 默认缓存配置
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  tenantInfoTtl: 60 * 60 * 1000, // 1小时
  modelListTtl: 24 * 60 * 60 * 1000, // 24小时
  maxCacheSize: 100,
};

/**
 * 缓存管理类
 */
export class CacheManager {
  private config: CacheConfig;
  private cache: Map<string, CacheItem<any>>;
  private stats: {
    hitCount: number;
    missCount: number;
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.cache = new Map();
    this.stats = {
      hitCount: 0,
      missCount: 0,
    };
  }

  /**
   * 生成缓存键
   */
  private generateKey(type: string, identifier: string): string {
    return `${type}:${identifier}`;
  }

  /**
   * 检查缓存项是否过期
   */
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() > item.expiresAt;
  }

  /**
   * 清理过期缓存项
   */
  private cleanup(): void {
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 检查缓存大小限制
   */
  private enforceSizeLimit(): void {
    if (this.cache.size > this.config.maxCacheSize) {
      // 按最后访问时间排序，删除最久未使用的项
      const entries = Array.from(this.cache.entries())
        .toSorted((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

      const deleteCount = this.cache.size - this.config.maxCacheSize;
      for (let i = 0; i < deleteCount; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * 获取缓存项
   */
  private get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.missCount++;
      return null;
    }

    if (this.isExpired(item)) {
      this.cache.delete(key);
      this.stats.missCount++;
      return null;
    }

    // 更新访问统计
    item.accessCount++;
    item.lastAccessedAt = Date.now();
    this.stats.hitCount++;

    return item.value as T;
  }

  /**
   * 设置缓存项
   */
  private set<T>(key: string, value: T, ttl: number): void {
    if (!this.config.enabled) {
      return;
    }

    // 清理过期项
    this.cleanup();

    const item: CacheItem<T> = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
    };

    this.cache.set(key, item);

    // 强制执行大小限制
    this.enforceSizeLimit();
  }

  /**
   * 缓存租户信息
   * 注意：只缓存租户ID和用户ID，不缓存token
   */
  setTenantInfo(tenantInfo: warrenqTenantInfo): void {
    const key = this.generateKey("tenant", tenantInfo.userId);

    // 只缓存非敏感信息
    const safeTenantInfo = {
      tenantId: tenantInfo.tenantId,
      userId: tenantInfo.userId,
      // 不缓存 access_token
    };

    this.set(key, safeTenantInfo, this.config.tenantInfoTtl);
  }

  /**
   * 获取缓存的租户信息
   */
  getTenantInfo(userId: string): Partial<warrenqTenantInfo> | null {
    const key = this.generateKey("tenant", userId);
    return this.get<Partial<warrenqTenantInfo>>(key);
  }

  /**
   * 缓存模型列表
   */
  setModelList(modelList: warrenqModelList): void {
    const key = this.generateKey("models", "default");
    this.set(key, modelList, this.config.modelListTtl);
  }

  /**
   * 获取缓存的模型列表
   */
  getModelList(): warrenqModelList | null {
    const key = this.generateKey("models", "default");
    return this.get<warrenqModelList>(key);
  }

  /**
   * 使租户信息缓存失效
   */
  invalidateTenantInfo(userId: string): void {
    const key = this.generateKey("tenant", userId);
    this.cache.delete(key);
  }

  /**
   * 使模型列表缓存失效
   */
  invalidateModelList(): void {
    const key = this.generateKey("models", "default");
    this.cache.delete(key);
  }

  /**
   * 使所有缓存失效
   */
  invalidateAll(): void {
    this.cache.clear();
    this.stats.hitCount = 0;
    this.stats.missCount = 0;
  }

  /**
   * 清理过期缓存项
   */
  cleanupExpired(): number {
    this.cleanup();
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hitCount + this.stats.missCount;
    const hitRate = totalRequests > 0
      ? (this.stats.hitCount / totalRequests) * 100
      : 0;

    let tenantInfoItems = 0;
    let modelListItems = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith("tenant:")) {
        tenantInfoItems++;
      } else if (key.startsWith("models:")) {
        modelListItems++;
      }
    }

    return {
      totalItems: this.cache.size,
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      hitRate,
      tenantInfoItems,
      modelListItems,
    };
  }

  /**
   * 格式化缓存统计信息
   */
  formatStats(): string {
    const stats = this.getStats();
    return [
      "缓存统计信息",
      "===========",
      `总缓存项数: ${stats.totalItems}`,
      `租户信息项: ${stats.tenantInfoItems}`,
      `模型列表项: ${stats.modelListItems}`,
      "",
      "命中率:",
      `  命中: ${stats.hitCount}`,
      `  未命中: ${stats.missCount}`,
      `  命中率: ${stats.hitRate.toFixed(2)}%`,
      "",
      `缓存状态: ${this.config.enabled ? "启用" : "禁用"}`,
      `租户信息TTL: ${this.config.tenantInfoTtl / 1000 / 60} 分钟`,
      `模型列表TTL: ${this.config.modelListTtl / 1000 / 60 / 60} 小时`,
      `最大缓存大小: ${this.config.maxCacheSize}`,
    ].join("\n");
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };

    // 如果禁用缓存，清除所有缓存
    if (!this.config.enabled) {
      this.invalidateAll();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<CacheConfig> {
    return { ...this.config };
  }
}

/**
 * 全局缓存管理实例
 */
export const cacheManager = new CacheManager();

/**
 * 缓存装饰器
 * 用于自动缓存函数结果
 */
export function cached<T extends any[], R>(
  cacheKeyFn: (...args: T) => string,
  ttlMs: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: R; expiresAt: number }>();

    descriptor.value = async function (...args: T): Promise<R> {
      const cacheKey = cacheKeyFn(...args);
      const cached = cache.get(cacheKey);

      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }

      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, {
        value: result,
        expiresAt: Date.now() + ttlMs,
      });

      return result;
    };

    return descriptor;
  };
}
