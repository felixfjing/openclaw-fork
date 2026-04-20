#!/usr/bin/env node
/**
 * 从 GitHub 仓库拉取预装技能并部署到 ~/.openclaw/skills/
 *
 * 移植自 ClawX 的 bundle-preinstalled-skills.mjs，适配 openclaw 开发流程。
 * 使用 git sparse checkout 从远程仓库拉取指定技能目录。
 *
 * 用法: node scripts/prepare-preinstalled-skills.mjs
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const MANIFEST_PATH = join(REPO_ROOT, "resources", "skills", "preinstalled-manifest.json");
const OPENCLAW_HOME = join(homedir(), ".openclaw");
const SKILLS_DIR = join(OPENCLAW_HOME, "skills");
const LOCK_PATH = join(SKILLS_DIR, ".preinstalled-lock.json");
const TMP_DIR = join(OPENCLAW_HOME, ".tmp-skills-fetch");

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`找不到技能清单: ${MANIFEST_PATH}`);
  }
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.skills)) {
    throw new Error("无效的预装技能清单格式");
  }
  return parsed.skills;
}

function loadLock() {
  if (!existsSync(LOCK_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LOCK_PATH, "utf8"));
  } catch {
    return null;
  }
}

function isSkillDeployed(lock, slug) {
  return lock?.skills?.some((s) => s.slug === slug) ?? false;
}

function groupByRepoRef(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const ref = entry.ref || "main";
    const key = `${entry.repo}#${ref}`;
    if (!grouped.has(key)) grouped.set(key, { repo: entry.repo, ref, entries: [] });
    grouped.get(key).entries.push(entry);
  }
  return [...grouped.values()];
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" }).trim();
}

function filterCopy(src) {
  const base = basename(src);
  return base !== ".git" && base !== ".subset.tar";
}

async function fetchSparseRepo(repo, ref, paths, checkoutDir) {
  const remote = `https://github.com/${repo}.git`;
  mkdirSync(checkoutDir, { recursive: true });

  git(["init"], checkoutDir);
  git(["remote", "add", "origin", remote], checkoutDir);
  git(["fetch", "--depth", "1", "origin", ref], checkoutDir);

  const normalizedPaths = [...new Set(
    paths.map((p) => p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")),
  )];
  git(["archive", "--format=tar", "--output", ".subset.tar", "FETCH_HEAD", ...normalizedPaths], checkoutDir);

  execFileSync("tar", ["-xf", ".subset.tar"], { cwd: checkoutDir, stdio: "pipe" });
  rmSync(join(checkoutDir, ".subset.tar"), { force: true });

  const commit = git(["rev-parse", "FETCH_HEAD"], checkoutDir);
  return commit;
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.warn("[skills] 清单文件不存在，跳过技能部署");
    return false;
  }

  const manifestSkills = loadManifest();
  const lock = loadLock();

  const pendingSkills = manifestSkills.filter(
    (s) => !isSkillDeployed(lock, s.slug),
  );

  if (pendingSkills.length === 0) {
    console.log(`[skills] 所有预装技能已部署 (${manifestSkills.length} 个)`);
    return true;
  }

  console.log(`[skills] 需要部署 ${pendingSkills.length}/${manifestSkills.length} 个技能...`);
  mkdirSync(SKILLS_DIR, { recursive: true });

  const newLock = {
    generatedAt: new Date().toISOString(),
    skills: lock?.skills ? [...lock.skills] : [],
  };

  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  try {
    const groups = groupByRepoRef(pendingSkills);

    for (const group of groups) {
      const repoDir = join(TMP_DIR, group.repo.replace(/[\\/]/g, "__"));
      const sparsePaths = [...new Set(group.entries.map((e) => e.repoPath))];

      console.log(`[skills] 拉取 ${group.repo} @ ${group.ref}...`);
      let commit;
      try {
        commit = await fetchSparseRepo(group.repo, group.ref, sparsePaths, repoDir);
      } catch (err) {
        console.warn(`[skills] 拉取 ${group.repo} 失败: ${err.message}`);
        continue;
      }
      console.log(`[skills]   commit ${commit}`);

      for (const entry of group.entries) {
        const sourceDir = join(repoDir, entry.repoPath);
        const targetDir = join(SKILLS_DIR, entry.slug);

        if (!existsSync(sourceDir)) {
          console.warn(`[skills]   跳过 ${entry.slug}: 源路径 ${entry.repoPath} 不存在`);
          continue;
        }

        rmSync(targetDir, { recursive: true, force: true });
        cpSync(sourceDir, targetDir, { recursive: true, dereference: true, filter: filterCopy });

        const version = !entry.version || entry.version === "main" ? commit : entry.version;
        newLock.skills.push({
          slug: entry.slug,
          version,
          repo: entry.repo,
          repoPath: entry.repoPath,
          ref: group.ref,
          commit,
        });

        console.log(`[skills]   已部署 ${entry.slug}`);
      }
    }

    writeFileSync(LOCK_PATH, `${JSON.stringify(newLock, null, 2)}\n`, "utf8");
    console.log(`[skills] 部署完成: ${newLock.skills.length}/${manifestSkills.length} 个技能`);
    return true;
  } catch (err) {
    console.warn(`[skills] 部署失败: ${err.message}`);
    return false;
  } finally {
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

export { main as preparePreinstalledSkills };

if (process.argv[1]?.endsWith("prepare-preinstalled-skills.mjs")) {
  main();
}
