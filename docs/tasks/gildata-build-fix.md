# Gildata Extension Build Configuration Fix

## 问题概述

gildata 扩展在运行 `pnpm build` 时失败，报错信息为：
```
Cannot resolve entry module extensions/gildata/index.ts
```

## 根本原因

1. **错误的入口点配置**：`extensions/gildata/package.json` 中的 `openclaw.extensions` 字段指向了 `./index.ts`，但实际的入口文件位于 `./src/index.ts`
2. **缺失的导出**：`extensions/gildata/src/dynamic-models.ts` 中的 `GILDATA_DEFAULT_BASE_URL` 常量未导出，但 `api.ts` 中尝试导入它

## 修复内容

### 1. 修正 package.json 入口点路径

**文件**: `extensions/gildata/package.json`

**修改前**:
```json
"openclaw": {
  "extensions": [
    "./index.ts"
  ]
}
```

**修改后**:
```json
"openclaw": {
  "extensions": [
    "./src/index.ts"
  ]
}
```

### 2. 导出缺失的常量

**文件**: `extensions/gildata/src/dynamic-models.ts`

**修改前**:
```typescript
/**
 * Gildata API基础URL
 */
const GILDATA_DEFAULT_BASE_URL = "https://api.gildata.com";
```

**修改后**:
```typescript
/**
 * Gildata API基础URL
 */
export const GILDATA_DEFAULT_BASE_URL = "https://api.gildata.com";
```

## 验证结果

修复后，运行 `pnpm build` 的结果：
- ✅ gildata 扩展成功编译
- ✅ 生成的文件：`dist/extensions/gildata/src/index.js` (108行)
- ✅ tsdown 构建阶段通过，无 `MISSING_EXPORT` 警告
- ✅ 构建产物正确包含 provider 注册逻辑

## 注意事项

- 构建过程中的 Node.js 版本警告（需要 v22.14.0+，当前使用 v20.20.0）是环境配置问题，不影响本次修复
- gildata 扩展现在已经可以正常集成到构建流程中
- 所有导出的常量和函数都已在 `dynamic-models.ts` 中正确声明为 `export`

## 相关文件

- `/Volumes/Data/Project/StudyPro/AiPro/openclaw/extensions/gildata/package.json`
- `/Volumes/Data/Project/StudyPro/AiPro/openclaw/extensions/gildata/src/dynamic-models.ts`
- `/Volumes/Data/Project/StudyPro/AiPro/openclaw/extensions/gildata/src/api.ts`
- `/Volumes/Data/Project/StudyPro/AiPro/openclaw/extensions/gildata/src/index.ts`

---

**修复人**: 胡丹
**修复日期**: 2026-04-15
