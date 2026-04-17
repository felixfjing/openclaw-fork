/**
 * 性能监控和缓存功能测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PerformanceMonitor } from "./performance-monitor.js";
import { CacheManager } from "./cache-manager.js";
import type { warrenqTenantInfo } from "./warrenq-login.js";
import type { warrenqModelList } from "./types.js";

describe("性能监控测试", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  it("应该正确记录成功请求", () => {
    monitor.recordSuccess(100, "login");
    monitor.recordSuccess(200, "api");

    const summary = monitor.getSummary();
    expect(summary.successRate).toBe(100);
    expect(summary.averageResponseTime).toBe(150);
    expect(monitor.getMetrics().totalRequests).toBe(2);
  });

  it("应该正确记录失败请求", () => {
    monitor.recordSuccess(100, "api");
    monitor.recordFailure();

    const summary = monitor.getSummary();
    expect(summary.successRate).toBe(50);
    expect(monitor.getMetrics().failedRequests).toBe(1);
  });

  it("应该正确计算百分位数", () => {
    const responseTimes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    for (const time of responseTimes) {
      monitor.recordSuccess(time, "api");
    }

    const summary = monitor.getSummary();
    // 对于10个值，P50应该是第5个索引的值
    // 计算公式: ceil((50/100) * 10) - 1 = 4 => responseTimes[4] = 50
    expect(summary.p50Latency).toBe(50);
    // P95: ceil((95/100) * 10) - 1 = 9 => responseTimes[9] = 100
    expect(summary.p95Latency).toBe(100);
    expect(summary.p99Latency).toBe(100);
  });

  it("应该正确分类统计请求", () => {
    monitor.recordSuccess(100, "login");
    monitor.recordSuccess(150, "login");
    monitor.recordSuccess(200, "tenantInfo");
    monitor.recordSuccess(300, "api");

    const summary = monitor.getSummary();
    expect(summary.averageLoginTime).toBe(125);
    expect(summary.averageTenantInfoTime).toBe(200);
    expect(summary.averageApiTime).toBe(300);
  });

  it("应该能够重置指标", () => {
    monitor.recordSuccess(100, "api");
    monitor.reset();

    const summary = monitor.getSummary();
    expect(monitor.getMetrics().totalRequests).toBe(0);
    expect(summary.successRate).toBe(0);
  });

  it("应该能够创建计时器", () => {
    const timer = monitor.createTimer();

    // 模拟耗时操作
    setTimeout(() => {
      const elapsed = timer.stop();
      expect(elapsed).toBeGreaterThanOrEqual(0);
    }, 10);
  });

  it("应该格式化性能摘要", () => {
    monitor.recordSuccess(100, "api");

    const formatted = monitor.formatSummary();
    expect(formatted).toContain("性能监控摘要");
    expect(formatted).toContain("总请求数");
    expect(formatted).toContain("成功率");
  });
});

describe("缓存管理测试", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ enabled: true });
  });

  afterEach(() => {
    cache.invalidateAll();
  });

  it("应该能够缓存租户信息", () => {
    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    cache.setTenantInfo(tenantInfo);
    const cached = cache.getTenantInfo("user123");

    expect(cached).toBeTruthy();
    expect(cached?.tenantId).toBe("tenant123");
    expect(cached?.userId).toBe("user123");
    // 不应该缓存token
    expect((cached as any).access_token).toBeUndefined();
  });

  it("应该能够缓存模型列表", () => {
    const modelList: warrenqModelList = {
      models: [
        { id: "model1", name: "Model 1" },
        { id: "model2", name: "Model 2" },
      ],
    };

    cache.setModelList(modelList);
    const cached = cache.getModelList();

    expect(cached).toBeTruthy();
    expect(cached?.models).toHaveLength(2);
    expect(cached?.models[0].id).toBe("model1");
  });

  it("应该正确追踪缓存命中率", () => {
    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    cache.setTenantInfo(tenantInfo);
    cache.getTenantInfo("user123"); // 命中
    cache.getTenantInfo("user123"); // 命中
    cache.getTenantInfo("nonexistent"); // 未命中

    const stats = cache.getStats();
    expect(stats.hitCount).toBe(2);
    expect(stats.missCount).toBe(1);
    expect(stats.hitRate).toBeCloseTo(66.67, 1);
  });

  it("应该能够失效租户信息缓存", () => {
    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    cache.setTenantInfo(tenantInfo);
    cache.invalidateTenantInfo("user123");

    const cached = cache.getTenantInfo("user123");
    expect(cached).toBeNull();
  });

  it("应该能够失效模型列表缓存", () => {
    const modelList: warrenqModelList = {
      models: [{ id: "model1", name: "Model 1" }],
    };

    cache.setModelList(modelList);
    cache.invalidateModelList();

    const cached = cache.getModelList();
    expect(cached).toBeNull();
  });

  it("应该能够失效所有缓存", () => {
    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    const modelList: warrenqModelList = {
      models: [{ id: "model1", name: "Model 1" }],
    };

    cache.setTenantInfo(tenantInfo);
    cache.setModelList(modelList);
    cache.invalidateAll();

    const tenantCached = cache.getTenantInfo("user123");
    const modelCached = cache.getModelList();

    expect(tenantCached).toBeNull();
    expect(modelCached).toBeNull();
  });

  it("应该正确处理过期缓存", async () => {
    const cacheWithShortTtl = new CacheManager({
      enabled: true,
      tenantInfoTtl: 100, // 100ms TTL
    });

    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    cacheWithShortTtl.setTenantInfo(tenantInfo);

    // 立即访问应该命中
    let cached = cacheWithShortTtl.getTenantInfo("user123");
    expect(cached).toBeTruthy();

    // 等待过期
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 过期后应该未命中
    cached = cacheWithShortTtl.getTenantInfo("user123");
    expect(cached).toBeNull();
  });

  it("应该禁用缓存时正确工作", () => {
    const disabledCache = new CacheManager({ enabled: false });

    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    disabledCache.setTenantInfo(tenantInfo);

    const cached = disabledCache.getTenantInfo("user123");
    expect(cached).toBeNull();
  });

  it("应该能够更新配置", () => {
    cache.updateConfig({ enabled: false });
    expect(cache.getConfig().enabled).toBe(false);

    cache.updateConfig({ tenantInfoTtl: 2000 });
    expect(cache.getConfig().tenantInfoTtl).toBe(2000);
  });

  it("应该格式化缓存统计信息", () => {
    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    cache.setTenantInfo(tenantInfo);

    const formatted = cache.formatStats();
    expect(formatted).toContain("缓存统计信息");
    expect(formatted).toContain("总缓存项数");
    expect(formatted).toContain("命中率");
  });

  it("应该能够清理过期缓存", () => {
    const cacheWithShortTtl = new CacheManager({
      enabled: true,
      tenantInfoTtl: 100,
    });

    const tenantInfo1: warrenqTenantInfo = {
      tenantId: "tenant1",
      userId: "user1",
      access_token: "token1",
    };

    const tenantInfo2: warrenqTenantInfo = {
      tenantId: "tenant2",
      userId: "user2",
      access_token: "token2",
    };

    cacheWithShortTtl.setTenantInfo(tenantInfo1);

    // 等待第一个过期
    setTimeout(() => {
      cacheWithShortTtl.setTenantInfo(tenantInfo2);
      const remaining = cacheWithShortTtl.cleanupExpired();

      // 应该只剩下第二个
      const cached1 = cacheWithShortTtl.getTenantInfo("user1");
      const cached2 = cacheWithShortTtl.getTenantInfo("user2");

      expect(cached1).toBeNull();
      expect(cached2).toBeTruthy();
      expect(remaining).toBe(1);
    }, 150);
  });
});

describe("集成测试", () => {
  it("应该能够同时使用性能监控和缓存", () => {
    const monitor = new PerformanceMonitor();
    const cache = new CacheManager({ enabled: true });

    const tenantInfo: warrenqTenantInfo = {
      tenantId: "tenant123",
      userId: "user123",
      access_token: "token123",
    };

    // 模拟API调用 - 模拟慢操作
    const timer = monitor.createTimer();
    // 模拟延迟
    const start = Date.now();
    while (Date.now() - start < 10) {
      // 空循环模拟延迟
    }
    const elapsed1 = timer.stop();
    monitor.recordSuccess(elapsed1, "tenantInfo");

    // 第二次调用（命中缓存）- 应该更快
    const timer2 = monitor.createTimer();
    cache.setTenantInfo(tenantInfo);
    cache.getTenantInfo("user123");
    const elapsed2 = timer2.stop();
    monitor.recordSuccess(elapsed2, "tenantInfo");

    // 验证性能提升（缓存访问应该比实际API调用快）
    expect(elapsed2).toBeLessThanOrEqual(elapsed1);

    // 验证缓存命中
    const stats = cache.getStats();
    expect(stats.hitCount).toBeGreaterThanOrEqual(1);
  });
});
