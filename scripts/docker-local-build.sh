#!/bin/bash
# docker-local-build.sh — 在网络受限环境中使用本地构建产物更新 Docker 镜像
# 不复制 node_modules 以减少构建上下文大小（旧镜像已有）
# 用法: bash scripts/docker-local-build.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/.docker-local-build-$(date +%s)"

echo "=> 准备构建上下文..."
mkdir -p "$BUILD_DIR"

# 仅复制变更的文件（跳过 node_modules 和大型构建缓存）
copy_dir() {
  echo "   复制 $1/..."
  cp -R "$PROJECT_DIR/$1" "$BUILD_DIR/$1" 2>/dev/null || true
}

copy_dir "dist"
copy_dir "extensions"
copy_dir "skills"
copy_dir "docs"
copy_dir "qa"

echo "   复制配置文件..."
cp "$PROJECT_DIR/package.json" "$BUILD_DIR/"
cp "$PROJECT_DIR/openclaw.mjs" "$BUILD_DIR/"

# 复制 Dockerfile.local
cp "$PROJECT_DIR/Dockerfile.local" "$BUILD_DIR/Dockerfile"

# 创建最小 .dockerignore
echo "" > "$BUILD_DIR/.dockerignore"

# 验证
echo "=> 验证构建上下文..."
for d in dist extensions skills docs qa; do
  if [ -d "$BUILD_DIR/$d" ]; then
    SIZE=$(du -sh "$BUILD_DIR/$d" 2>/dev/null | cut -f1)
    echo "   OK: $d ($SIZE)"
  else
    echo "   缺失: $d"
  fi
done

echo "=> 构建 Docker 镜像..."
docker build -t openclaw:local "$BUILD_DIR"

echo "=> 清理临时目录..."
rm -rf "$BUILD_DIR"

echo "=> 构建完成！镜像: openclaw:local"
