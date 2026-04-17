import { describe, it, expect } from "vitest";
import {
  extractwarrenqHeaders,
  buildwarrenqRequestHeaders,
} from "./warrenq-auth.js";

describe("warrenq Auth", () => {
  describe("extractwarrenqHeaders", () => {
    it("should extract authorization header", () => {
      const headers = extractwarrenqHeaders({
        "Authorization": "Bearer test-token",
      });
      expect(headers.Authorization).toBe("Bearer test-token");
    });

    it("should extract user id header", () => {
      const headers = extractwarrenqHeaders({
        "X-warrenq-User-Id": "user-123",
      });
      expect(headers["X-warrenq-User-Id"]).toBe("user-123");
    });

    it("should extract session id header", () => {
      const headers = extractwarrenqHeaders({
        "X-warrenq-Session-Id": "session-456",
      });
      expect(headers["X-warrenq-Session-Id"]).toBe("session-456");
    });

    it("should extract tenant id header", () => {
      const headers = extractwarrenqHeaders({
        "X-warrenq-Tenant-Id": "tenant-789",
      });
      expect(headers["X-warrenq-Tenant-Id"]).toBe("tenant-789");
    });

    it("should extract all headers", () => {
      const headers = extractwarrenqHeaders({
        "Authorization": "Bearer test-token",
        "X-warrenq-User-Id": "user-123",
        "X-warrenq-Session-Id": "session-456",
        "X-warrenq-Tenant-Id": "tenant-789",
      });
      expect(headers.Authorization).toBe("Bearer test-token");
      expect(headers["X-warrenq-User-Id"]).toBe("user-123");
      expect(headers["X-warrenq-Session-Id"]).toBe("session-456");
      expect(headers["X-warrenq-Tenant-Id"]).toBe("tenant-789");
    });

    it("should handle case-insensitive header names", () => {
      const headers = extractwarrenqHeaders({
        "authorization": "Bearer test-token",
        "x-warrenq-user-id": "user-123",
      });
      expect(headers.Authorization).toBe("Bearer test-token");
      expect(headers["X-warrenq-User-Id"]).toBe("user-123");
    });

    it("should handle missing headers", () => {
      const headers = extractwarrenqHeaders({});
      expect(headers.Authorization).toBeUndefined();
      expect(headers["X-warrenq-User-Id"]).toBeUndefined();
      expect(headers["X-warrenq-Session-Id"]).toBeUndefined();
      expect(headers["X-warrenq-Tenant-Id"]).toBeUndefined();
    });
  });

  describe("buildwarrenqRequestHeaders", () => {
    it("should build headers with api key", () => {
      const headers = buildwarrenqRequestHeaders(
        { apiKey: "test-api-key" },
      );
      expect(headers.Authorization).toBe("Bearer test-api-key");
    });

    it("should add dynamic headers", () => {
      const dynamicHeaders = {
        "X-warrenq-User-Id": "user-123",
        "X-warrenq-Session-Id": "session-456",
      };
      const headers = buildwarrenqRequestHeaders(
        { apiKey: "test-api-key" },
        dynamicHeaders,
      );
      expect(headers.Authorization).toBe("Bearer test-api-key");
      expect(headers["X-warrenq-User-Id"]).toBe("user-123");
      expect(headers["X-warrenq-Session-Id"]).toBe("session-456");
    });

    it("should add custom headers", () => {
      const headers = buildwarrenqRequestHeaders(
        {
          apiKey: "test-api-key",
          customHeaders: {
            "X-Custom-Header": "custom-value",
          },
        },
      );
      expect(headers.Authorization).toBe("Bearer test-api-key");
      expect(headers["X-Custom-Header"]).toBe("custom-value");
    });

    it("should merge dynamic and custom headers", () => {
      const dynamicHeaders = {
        "X-warrenq-User-Id": "user-123",
      };
      const headers = buildwarrenqRequestHeaders(
        {
          apiKey: "test-api-key",
          customHeaders: {
            "X-Custom-Header": "custom-value",
          },
        },
        dynamicHeaders,
      );
      expect(headers.Authorization).toBe("Bearer test-api-key");
      expect(headers["X-warrenq-User-Id"]).toBe("user-123");
      expect(headers["X-Custom-Header"]).toBe("custom-value");
    });
  });
});
