/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : store.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: Tauri Store 插件单例封装（目录配置读写）
 * ======================================================
 */

import { load, type Store } from "@tauri-apps/plugin-store";

import { DIRECTORY_CONFIG_KEY, STORE_FILE } from "@/config/settings";

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
 * 校验值是否为合法的路径数组
 *
 * @param value - 待校验的值
 * @returns 是 string[] 返回 true
 */
function isValidPathArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
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
 * 非 Tauri 环境或读取失败时返回空数组（静默降级）。
 *
 * @returns 路径数组；无数据或异常时返回 []
 */
export async function readDirectoryConfig(): Promise<readonly string[]> {
  if (!isTauriEnv()) {
    return [];
  }
  try {
    const store = await loadStore();
    const raw = await store.get<unknown>(DIRECTORY_CONFIG_KEY);
    return isValidPathArray(raw) ? raw : [];
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
 * @param paths - 路径数组
 */
export async function writeDirectoryConfig(
  paths: readonly string[],
): Promise<void> {
  if (!isTauriEnv()) {
    return;
  }
  try {
    const store = await loadStore();
    await store.set(DIRECTORY_CONFIG_KEY, Array.from(paths));
    await store.save();
  } catch (error) {
    // 写入失败（磁盘满、权限拒绝等）静默降级，UI 仍可用
    console.warn("[store] writeDirectoryConfig failed:", error);
  }
}
