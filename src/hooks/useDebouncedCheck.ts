/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useDebouncedCheck.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 路径存在性防抖校验 hook
 * ======================================================
 */

import { useEffect, useRef, useState } from "react";

import { exists } from "@tauri-apps/plugin-fs";

import type { DirectoryValidation } from "@/types/settings";

/** 默认防抖时长（毫秒） */
const DEFAULT_DEBOUNCE_MS = 400;

/**
 * 判断当前是否运行在 Tauri 环境
 *
 * 非 Tauri 环境调用 exists 会抛错，需降级为 idle 不校验。
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
 * 路径存在性防抖校验
 *
 * 输入路径变化时延迟 debounceMs 调用 Tauri fs.exists，
 * 避免逐字符触发磁盘 IO。
 *
 * - 空路径：返回 idle（不校验）
 * - 非 Tauri 环境：返回 idle（无法校验）
 * - 校验中：返回 checking
 * - 校验完成：返回 valid / invalid
 *
 * @param path - 待校验的路径
 * @param debounceMs - 防抖时长，默认 400ms
 * @returns 校验状态
 */
export function useDebouncedCheck(
  path: string,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): DirectoryValidation {
  const [state, setState] = useState<DirectoryValidation>({
    status: "idle",
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 空路径：直接 idle，不触发 fs 调用
    if (!path.trim()) {
      setState({ status: "idle" });
      return;
    }
    // 非 Tauri 环境：无法校验，直接 idle
    if (!isTauriEnv()) {
      setState({ status: "idle" });
      return;
    }

    // 先切到 checking（立即反馈），延迟再调 fs
    setState({ status: "checking" });
    timerRef.current = setTimeout(async () => {
      try {
        const ok = await exists(path);
        setState(ok ? { status: "valid" } : { status: "invalid" });
      } catch (error) {
        // exists 异常（路径非法、权限拒绝等）视为无效
        console.warn("[useDebouncedCheck] exists failed:", error);
        setState({ status: "invalid" });
      }
    }, debounceMs);

    return () => {
      // 清除上一次的 timer，避免卸载后 setState 与重复调用
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [path, debounceMs]);

  return state;
}
