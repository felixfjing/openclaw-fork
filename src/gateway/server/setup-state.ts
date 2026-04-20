/**
 * Setup 状态管理模块
 *
 * 负责读写 ~/.openclaw/setup-state.json 文件，
 * 并自动检测 uv、技能、provider 的安装状态。
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, platform, arch } from "node:os";

export interface SetupState {
  /** uv 二进制是否已安装 */
  uvInstalled: boolean;
  /** 技能是否已部署 */
  skillsDeployed: boolean;
  /** Provider 是否已配置 */
  providerConfigured: boolean;
  /** 所有步骤是否均已完成 */
  completed: boolean;
  /** 最后更新时间（ISO 8601） */
  updatedAt: string | null;
}

const SETUP_STATE_FILENAME = "setup-state.json";

const DEFAULT_STATE: SetupState = {
  uvInstalled: false,
  skillsDeployed: false,
  providerConfigured: false,
  completed: false,
  updatedAt: null,
};

/** 获取 OpenClaw 主目录路径 */
export function getOpenClawHome(): string {
  return process.env.OPENCLAW_HOME ?? join(homedir(), ".openclaw");
}

/** 从指定目录读取 setup 状态，不存在则返回默认值 */
export function readSetupState(homeDir?: string): SetupState {
  const dir = homeDir ?? getOpenClawHome();
  const filePath = join(dir, SETUP_STATE_FILENAME);
  if (!existsSync(filePath)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = readFileSync(filePath, "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** 将 setup 状态写入指定目录 */
export function writeSetupState(homeDir: string, state: SetupState): void {
  const dir = homeDir ?? getOpenClawHome();
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, SETUP_STATE_FILENAME);
  writeFileSync(
    filePath,
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

/**
 * 自动检测当前 setup 状态
 *
 * 检查项：
 * - uv 二进制是否存在（bin/<platform>-<arch>/uv）
 * - 技能部署锁文件是否存在（skills/.preinstalled-lock.json）
 * - 主配置文件中是否有 provider 配置（openclaw.json → providers）
 */
export function detectSetupState(homeDir?: string): SetupState {
  const dir = homeDir ?? getOpenClawHome();
  const current = readSetupState(dir);

  // 检测 uv 二进制
  const platformId = `${platform()}-${arch()}`;
  const binName = platform() === "win32" ? "uv.exe" : "uv";
  const uvBinPath = join(dir, "bin", platformId, binName);
  current.uvInstalled = existsSync(uvBinPath);

  // 检测技能部署（检查 lock 文件）
  const lockPath = join(dir, "skills", ".preinstalled-lock.json");
  current.skillsDeployed = existsSync(lockPath);

  // 检测 provider 配置（检查主配置文件是否存在且包含 providers）
  const configPath = join(dir, "openclaw.json");
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      const providers = config?.models?.providers;
      current.providerConfigured =
        typeof providers === "object" && providers !== null && Object.keys(providers).length > 0;
    } catch {
      current.providerConfigured = false;
    }
  }

  // 综合判断：三项全部通过才算完成
  current.completed =
    current.uvInstalled &&
    current.skillsDeployed &&
    current.providerConfigured;

  return current;
}
