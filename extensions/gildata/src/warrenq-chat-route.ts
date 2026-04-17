import type { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { logger } from "./logger.js";

/**
 * GET /plugins/gildata/warrenq-chat 路由处理器
 *
 * 返回独立的综合助手聊天 HTML 页面。
 * 将 __OPENCLAW_BASE_PATH__ 替换为实际的 basePath。
 */
export async function handleWarrenqChatRoute(
  req: IncomingMessage,
  res: ServerResponse,
  basePath: string,
): Promise<boolean> {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end("Method Not Allowed");
    return true;
  }

  try {
    const distPath = path.resolve(process.cwd(), "dist/control-ui/warrenq-chat.html");

    let html: string;
    try {
      html = await fs.readFile(distPath, "utf-8");
    } catch {
      // 构建产物不存在，返回开发模式提示
      res.statusCode = 503;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>综合助手</title></head>
        <body style="background:#0d1117;color:#e0e0e0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>综合助手小龙虾</h2>
            <p>聊天页面正在构建中，请运行 <code>pnpm --filter ui build</code></p>
          </div>
        </body></html>`,
      );
      return true;
    }

    // 替换 basePath 占位符
    const bp = basePath || "";
    html = html.replace(/__OPENCLAW_BASE_PATH__/g, bp);

    // 注入 <base href="/"> 确保相对路径资源（./assets/）从根路径加载，
    // 因为页面 URL 是 /plugins/gildata/warrenq-chat，相对路径会错误解析到 /plugins/gildata/assets/
    html = html.replace("<head>", '<head><base href="/" />');

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(html);
    return true;
  } catch (error) {
    logger.error("提供聊天页面失败", error as Error);
    res.statusCode = 500;
    res.end("Internal Server Error");
    return true;
  }
}
