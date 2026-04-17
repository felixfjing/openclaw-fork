/**
 * warrenq性能监控模块
 *
 * 功能：
 * - 记录API请求的响应时间
 * - 追踪token获取时间
 * - 监控认证流程总耗时
 * - 统计请求成功率
 * - 计算延迟指标（P50/P95/P99）
 */

/**
 * 性能指标类型
 */
export interface PerformanceMetrics {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 所有响应时间（毫秒） */
  responseTimes: number[];
  /** 登录请求数 */
  loginRequests: number;
  /** 登录响应时间（毫秒） */
  loginTimes: number[];
  /** 租户信息请求次数 */
  tenantInfoRequests: number;
  /** 租户信息响应时间（毫秒） */
  tenantInfoTimes: number[];
  /** API请求次数 */
  apiRequests: number;
  /** API响应时间（毫秒） */
  apiTimes: number[];
}

/**
 * 性能统计摘要
 */
export interface PerformanceSummary {
  /** 请求成功率 */
  successRate: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
  /** 最小响应时间（毫秒） */
  minResponseTime: number;
  /** 最大响应时间（毫秒） */
  maxResponseTime: number;
  /** P50延迟（毫秒） */
  p50Latency: number;
  /** P95延迟（毫秒） */
  p95Latency: number;
  /** P99延迟（毫秒） */
  p99Latency: number;
  /** 登录平均时间（毫秒） */
  averageLoginTime: number;
  /** 租户信息平均时间（毫秒） */
  averageTenantInfoTime: number;
  /** API平均时间（毫秒） */
  averageApiTime: number;
}

/**
 * 计时器接口
 */
export interface PerformanceTimer {
  /** 停止计时并返回耗时（毫秒） */
  stop: () => number;
}

/**
 * 性能监控类
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimes: [],
    loginRequests: 0,
    loginTimes: [],
    tenantInfoRequests: 0,
    tenantInfoTimes: [],
    apiRequests: 0,
    apiTimes: [],
  };

  /**
   * 创建一个计时器
   */
  createTimer(): PerformanceTimer {
    const startTime = Date.now();
    return {
      stop: () => Date.now() - startTime,
    };
  }

  /**
   * 记录成功请求
   */
  recordSuccess(responseTime: number, type: "login" | "tenantInfo" | "api" = "api"): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.responseTimes.push(responseTime);

    switch (type) {
      case "login":
        this.metrics.loginRequests++;
        this.metrics.loginTimes.push(responseTime);
        break;
      case "tenantInfo":
        this.metrics.tenantInfoRequests++;
        this.metrics.tenantInfoTimes.push(responseTime);
        break;
      case "api":
        this.metrics.apiRequests++;
        this.metrics.apiTimes.push(responseTime);
        break;
    }
  }

  /**
   * 记录失败请求
   */
  recordFailure(): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;
  }

  /**
   * 获取性能摘要
   */
  getSummary(): PerformanceSummary {
    const responseTimes = [...this.metrics.responseTimes].toSorted((a, b) => a - b);

    const calculatePercentile = (p: number): number => {
      if (responseTimes.length === 0) {return 0;}
      const index = Math.ceil((p / 100) * responseTimes.length) - 1;
      return responseTimes[index];
    };

    const average = (arr: number[]): number => {
      if (arr.length === 0) {return 0;}
      return arr.reduce((sum, val) => sum + val, 0) / arr.length;
    };

    return {
      successRate: this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0,
      averageResponseTime: average(this.metrics.responseTimes),
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      p50Latency: calculatePercentile(50),
      p95Latency: calculatePercentile(95),
      p99Latency: calculatePercentile(99),
      averageLoginTime: average(this.metrics.loginTimes),
      averageTenantInfoTime: average(this.metrics.tenantInfoTimes),
      averageApiTime: average(this.metrics.apiTimes),
    };
  }

  /**
   * 获取原始指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      loginRequests: 0,
      loginTimes: [],
      tenantInfoRequests: 0,
      tenantInfoTimes: [],
      apiRequests: 0,
      apiTimes: [],
    };
  }

  /**
   * 格式化性能摘要为字符串
   */
  formatSummary(): string {
    const summary = this.getSummary();
    return [
      "性能监控摘要",
      "=============",
      `总请求数: ${this.metrics.totalRequests}`,
      `成功: ${this.metrics.successfulRequests} | 失败: ${this.metrics.failedRequests}`,
      `成功率: ${summary.successRate.toFixed(2)}%`,
      "",
      "响应时间（毫秒）:",
      `  平均: ${summary.averageResponseTime.toFixed(2)}`,
      `  最小: ${summary.minResponseTime}`,
      `  最大: ${summary.maxResponseTime}`,
      "",
      "延迟百分位数:",
      `  P50: ${summary.p50Latency.toFixed(2)}ms`,
      `  P95: ${summary.p95Latency.toFixed(2)}ms`,
      `  P99: ${summary.p99Latency.toFixed(2)}ms`,
      "",
      "分类统计:",
      `  登录请求: ${this.metrics.loginRequests} (平均: ${summary.averageLoginTime.toFixed(2)}ms)`,
      `  租户信息请求: ${this.metrics.tenantInfoRequests} (平均: ${summary.averageTenantInfoTime.toFixed(2)}ms)`,
      `  API请求: ${this.metrics.apiRequests} (平均: ${summary.averageApiTime.toFixed(2)}ms)`,
    ].join("\n");
  }
}

/**
 * 全局性能监控实例
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * 性能监控装饰器
 */
export function measurePerformance(type: "login" | "tenantInfo" | "api" = "api") {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = performanceMonitor.createTimer();

      try {
        const result = await originalMethod.apply(this, args);
        const elapsed = timer.stop();
        performanceMonitor.recordSuccess(elapsed, type);
        return result;
      } catch (error) {
        performanceMonitor.recordFailure();
        throw error;
      }
    };

    return descriptor;
  };
}
