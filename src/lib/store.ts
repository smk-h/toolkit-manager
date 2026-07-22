/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : store.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: Tauri Store 插件单例封装（目录配置读写，兼容旧格式迁移）
 * ======================================================
 */

import { load, type Store } from "@tauri-apps/plugin-store";

import { PROJECT_CONFIG_KEY } from "@/config/projects";
import { DIRECTORY_CONFIG_KEY, STORE_FILE } from "@/config/settings";
import type { StoredProjectItem } from "@/types/projects";
import type { StoredDirectoryItem } from "@/types/settings";

/**
 * 判断当前是否运行在 Tauri 环境
 *
 * 非 Tauri 环境（如纯浏览器 pnpm dev）调用插件 API 会抛错，
 * 各读写函数据此做优雅降级。
 *
 * @returns 是 Tauri 环境返回 true
 */
function isTauriEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/**
 * 校验值是否为旧版路径数组（string[]）
 *
 * 兼容迁移：旧版本 Store 中 directory-config 存的是 string[]，
 * 读取时检测到此格式则迁移为 { name: "", path } 形态。
 *
 * @param value - 待校验的值
 * @returns 是 string[] 返回 true
 */
function isLegacyPathArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((v) => typeof v === "string")
  );
}

/**
 * 校验值是否为新版目录项数组（{name,path}[]）
 *
 * name 缺失时容错为空字符串，兼容部分写入异常。
 *
 * @param value - 待校验的值
 * @returns 是对象数组返回 true
 */
function isStoredDirectoryArray(
  value: unknown,
): value is Array<{ name?: unknown; path?: unknown }> {
  return Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null);
}

/**
 * 加载 Store 单例
 *
 * 同一文件名多次调用返回同一实例（Store 插件内部维护）。
 * autoSave 关闭，由 writeDirectoryConfig 显式 save() 落盘。
 *
 * @returns Store 实例
 */
export async function loadStore(): Promise<Store> {
  return load(STORE_FILE, { autoSave: false });
}

/**
 * 读取目录配置
 *
 * 兼容两种历史格式：
 * - 旧版 string[]（仅路径）→ 自动迁移为 name="" 的项
 * - 新版 {name,path}[] → 原样返回
 *
 * 非 Tauri 环境或读取失败时返回空数组（静默降级）。
 * 预置项注入与去重由 useDirectoryConfig 负责（保持本层只管读写）。
 *
 * @returns 目录项数组；无数据或异常时返回 []
 */
export async function readDirectoryConfig(): Promise<
  readonly StoredDirectoryItem[]
> {
  if (!isTauriEnv()) {
    return [];
  }
  try {
    const store = await loadStore();
    const raw = await store.get<unknown>(DIRECTORY_CONFIG_KEY);
    if (raw === null || raw === undefined) {
      return [];
    }
    // 旧版 string[] → 迁移为 { name: "", path }
    if (isLegacyPathArray(raw)) {
      return raw.map((path) => ({ name: "", path }));
    }
    // 新版 {name,path}[]
    if (isStoredDirectoryArray(raw)) {
      return raw.map((item) => ({
        name: typeof item.name === "string" ? item.name : "",
        path: typeof item.path === "string" ? item.path : "",
      }));
    }
    // 格式不符：视为空，避免脏数据进入 UI
    return [];
  } catch (error) {
    // 读取失败（文件损坏、权限拒绝等）降级为空列表，避免阻塞 UI
    console.warn("[store] readDirectoryConfig failed:", error);
    return [];
  }
}

/**
 * 写入目录配置（立即落盘）
 *
 * 非 Tauri 环境直接返回；写入失败时 console.warn 不抛出，
 * 保证 UI 操作不被磁盘异常阻断。
 *
 * @param items - 目录项数组（仅 name 与 path 入库）
 */
export async function writeDirectoryConfig(
  items: readonly StoredDirectoryItem[],
): Promise<void> {
  if (!isTauriEnv()) {
    return;
  }
  try {
    const store = await loadStore();
    await store.set(
      DIRECTORY_CONFIG_KEY,
      Array.from(items).map((i) => ({ name: i.name, path: i.path })),
    );
    await store.save();
  } catch (error) {
    // 写入失败（磁盘满、权限拒绝等）静默降级，UI 仍可用
    console.warn("[store] writeDirectoryConfig failed:", error);
  }
}

/**
 * 校验值是否为项目项数组（{path}[]）
 *
 * path 缺失或类型不符时容错为空字符串，兼容部分写入异常。
 *
 * @param value - 待校验的值
 * @returns 是对象数组返回 true
 */
function isStoredProjectArray(
  value: unknown,
): value is Array<{ path?: unknown }> {
  return (
    Array.isArray(value) && value.every((v) => typeof v === "object" && v !== null)
  );
}

/**
 * 读取项目列表
 *
 * 从 Store 的 project-config 键读取 {path}[]。
 * 非 Tauri 环境或读取失败时返回空数组（静默降级），
 * 格式不符视为空，避免脏数据进入 UI。
 *
 * @returns 项目项数组；无数据或异常时返回 []
 */
export async function readProjectConfig(): Promise<
  readonly StoredProjectItem[]
> {
  if (!isTauriEnv()) {
    return [];
  }
  try {
    const store = await loadStore();
    const raw = await store.get<unknown>(PROJECT_CONFIG_KEY);
    if (raw === null || raw === undefined) {
      return [];
    }
    // 新版 {path}[]
    if (isStoredProjectArray(raw)) {
      return raw.map((item) => ({
        path: typeof item.path === "string" ? item.path : "",
      }));
    }
    // 格式不符：视为空，避免脏数据进入 UI
    return [];
  } catch (error) {
    // 读取失败降级为空列表，避免阻塞 UI
    console.warn("[store] readProjectConfig failed:", error);
    return [];
  }
}

/**
 * 写入项目列表（立即落盘）
 *
 * 非 Tauri 环境直接返回；写入失败时 console.warn 不抛出，
 * 保证 UI 操作不被磁盘异常阻断。
 *
 * @param items - 项目项数组（仅 path 入库）
 */
export async function writeProjectConfig(
  items: readonly StoredProjectItem[],
): Promise<void> {
  if (!isTauriEnv()) {
    return;
  }
  try {
    const store = await loadStore();
    await store.set(
      PROJECT_CONFIG_KEY,
      Array.from(items).map((i) => ({ path: i.path })),
    );
    await store.save();
  } catch (error) {
    // 写入失败静默降级，UI 仍可用
    console.warn("[store] writeProjectConfig failed:", error);
  }
}
