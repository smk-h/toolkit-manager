/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : settings.ts (config)
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设置页相关常量（Store 文件名与键名）
 * ======================================================
 */

/**
 * Tauri Store 文件名
 *
 * 应用级所有设置统一存这一份 JSON 文件，
 * 位于应用 cache 目录（Win: %APPDATA%\<identifier>\）。
 * 后续章节（主题切换、导入导出）的配置也写入此文件，按 key 区分。
 */
export const STORE_FILE = "settings.json" as const;

/**
 * 目录配置在 Store 中的键名
 *
 * 值为 {name, path}[]（见 StoredDirectoryItem），空字符串路径允许
 * （表示"新增但未填写"的项）。旧版本数据为 string[]，由 store.ts 兼容迁移。
 */
export const DIRECTORY_CONFIG_KEY = "directory-config" as const;

/**
 * 预置目录项：固定常驻、不可删除
 *
 * 名称固定，路径由用户在设置页选择，写入 Store 后供设备页按名称取用。
 * 预置项始终排在列表首位，且在加载时自动补齐（确保设备页随时可读到）。
 */
export const PRESET_DIRECTORY_ITEMS = [
  {
    name: "embedded-mcp-toolkit",
    path: "",
  },
] as const;
