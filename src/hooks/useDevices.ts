/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useDevices.ts
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备列表加载状态 hook（读取 yaml 并解析）
 * ======================================================
 */

import { useCallback, useEffect, useState } from "react";

import { PRESET_DEVICE_DIR_NAME } from "@/config/devices";
import { readDevices } from "@/lib/devices";
import type { DevicesStatus } from "@/types/device";
import { useDirectoryConfig } from "@/hooks/useDirectoryConfig";

/** useDevices hook 返回值 */
export interface UseDevicesResult {
  /** 当前加载状态（判别联合，含设备列表） */
  status: DevicesStatus;
  /** 重新读取（后续章节刷新用） */
  reload: () => void;
}

/**
 * 设备列表加载 hook
 *
 * 从目录配置中取 embedded-mcp-toolkit 预置项路径，读取其
 * .embedded/configs/devices 下的 yaml 文件并解析。
 *
 * - 目录配置加载期间 status 为 loading
 * - 预置项路径为空 → no-path；目录不存在 → dir-missing
 * - 解析完成 → ready（含设备列表）
 * - reload 重新触发读取
 *
 * @returns 加载状态与 reload
 */
export function useDevices(): UseDevicesResult {
  const { items, isLoading } = useDirectoryConfig();
  const [status, setStatus] = useState<DevicesStatus>({ kind: "loading" });
  // reload 计数器：递增后 effect 重新读取
  const [reloadCount, setReloadCount] = useState<number>(0);

  // 取预置项路径（仅在目录配置加载完成后查找）
  const presetItem = isLoading
    ? undefined
    : items.find((i) => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME);
  const basePath = presetItem?.path ?? "";

  /**
   * 触发重新读取
   *
   * 通过递增 reloadCount 让 effect 依赖变化，重新调用 readDevices。
   */
  const reload = useCallback((): void => {
    setReloadCount((c) => c + 1);
  }, []);

  useEffect(() => {
    // 目录配置未就绪：保持 loading，等待
    if (isLoading) {
      setStatus({ kind: "loading" });
      return;
    }

    // 路径为空：直接 no-path，无需调用 fs
    if (!basePath.trim()) {
      setStatus({ kind: "no-path" });
      return;
    }

    // 进入异步读取
    let cancelled = false;
    setStatus({ kind: "loading" });
    (async () => {
      const result = await readDevices(basePath);
      if (cancelled) {
        return; // 组件已卸载，丢弃结果
      }
      setStatus(result);
    })();

    return () => {
      cancelled = true;
    };
    // basePath 与 reloadCount 变化时重新读取
  }, [basePath, isLoading, reloadCount]);

  return { status, reload };
}
