#!/usr/bin/env node
/**
 * 下载 uv (Python 包管理器) 二进制文件到 ~/.openclaw/bin/
 *
 * 移植自 ClawX 的 download-bundled-uv.mjs，适配 openclaw 开发流程。
 * 纯 Node.js 实现，无外部依赖。
 *
 * 用法: node scripts/download-uv.mjs
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { homedir, platform, arch } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const UV_VERSION = "0.10.0";
const BASE_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;
const OPENCLAW_HOME = join(homedir(), ".openclaw");
const BIN_DIR = join(OPENCLAW_HOME, "bin");

const TARGETS = {
  "darwin-arm64": { filename: "uv-aarch64-apple-darwin.tar.gz", binName: "uv" },
  "darwin-x64": { filename: "uv-x86_64-apple-darwin.tar.gz", binName: "uv" },
  "win32-arm64": { filename: "uv-aarch64-pc-windows-msvc.zip", binName: "uv.exe" },
  "win32-x64": { filename: "uv-x86_64-pc-windows-msvc.zip", binName: "uv.exe" },
  "linux-arm64": { filename: "uv-aarch64-unknown-linux-gnu.tar.gz", binName: "uv" },
  "linux-x64": { filename: "uv-x86_64-unknown-linux-gnu.tar.gz", binName: "uv" },
};

function findFile(dir, name) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${res.statusText} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function extract(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (archive.endsWith(".zip")) {
    if (platform() === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `Expand-Archive -Path '${archive}' -DestinationPath '${destDir}' -Force`],
        { stdio: "pipe" },
      );
    } else {
      execFileSync("unzip", ["-q", "-o", archive, "-d", destDir], { stdio: "pipe" });
    }
  } else {
    execFileSync("tar", ["-xzf", archive, "-C", destDir], { stdio: "pipe" });
  }
}

async function main() {
  const currentId = `${platform()}-${arch()}`;
  const target = TARGETS[currentId];

  if (!target) {
    console.warn(`[uv] 不支持的平台: ${currentId}，跳过下载`);
    return false;
  }

  const targetDir = join(BIN_DIR, currentId);
  const destBin = join(targetDir, target.binName);

  if (existsSync(destBin)) {
    console.log(`[uv] 已安装: ${destBin}`);
    return true;
  }

  console.log(`[uv] 下载 uv ${UV_VERSION} for ${currentId}...`);
  mkdirSync(targetDir, { recursive: true });

  const tempDir = join(BIN_DIR, ".tmp-uv-extract");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });

  const archivePath = join(tempDir, target.filename);
  const downloadUrl = `${BASE_URL}/${target.filename}`;

  try {
    await download(downloadUrl, archivePath);
    extract(archivePath, tempDir);

    const folderName = target.filename.replace(".tar.gz", "").replace(".zip", "");
    let sourceBin = join(tempDir, folderName, target.binName);

    if (!existsSync(sourceBin)) {
      const found = findFile(tempDir, target.binName);
      if (!found) throw new Error(`在解压文件中找不到 ${target.binName}`);
      sourceBin = found;
    }

    copyFileSync(sourceBin, destBin);

    if (platform() !== "win32") {
      chmodSync(destBin, 0o755);
    }

    console.log(`[uv] 安装成功: ${destBin}`);
    return true;
  } catch (err) {
    console.warn(`[uv] 下载失败: ${err.message}`);
    return false;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export { main as downloadUv };

if (process.argv[1]?.endsWith("download-uv.mjs")) {
  main();
}
