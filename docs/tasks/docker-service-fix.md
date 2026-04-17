# OpenClaw Docker 服务修复记录

## 问题描述
- OpenClaw Gateway 服务无法访问 http://127.0.0.1:18789/automation
- Docker 容器不断重启（Restarting 状态）
- 日志显示配置错误：`models.providers.gildata.api` 使用了无效的 API 类型

## 根本原因
配置文件 `~/.openclaw/openclaw.json` 中的 `api` 字段使用了 `"chat/completions"`，但 OpenClaw 要求使用预定义的 API 类型。

## 修复方案

### 1. 修改配置文件
将 `/Users/hudan/.openclaw/openclaw.json` 中的：
```json
"api": "chat/completions"
```
修改为：
```json
"api": "openai-completions"
```

### 2. 设置环境变量并重启容器
```bash
export OPENCLAW_CONFIG_DIR=/Users/hudan/.openclaw
docker-compose restart openclaw-gateway
```

## 验证结果
- 容器正常启动，无错误日志
- HTTP 200 OK 响应返回正常
- 服务已恢复正常访问

## 关键点
- OpenClaw 的 API 配置必须使用预定义的类型
- Docker 容器需要正确设置 `OPENCLAW_CONFIG_DIR` 环境变量
- 配置文件更改后需要重新创建容器才能生效