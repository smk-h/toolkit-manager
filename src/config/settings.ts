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
 * 值为 string[]（路径数组），空字符串允许（表示"新增但未填写"的项）。
 */
export const DIRECTORY_CONFIG_KEY = "directory-config" as const;
