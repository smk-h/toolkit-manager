/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useDirectoryConfig.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 目录配置状态 hook（异步持久化到 Tauri Store）
 * ======================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { PRESET_DIRECTORY_ITEMS } from "@/config/settings";
import { basename } from "@/lib/path";
import { readDirectoryConfig, writeDirectoryConfig } from "@/lib/store";
import type { DirectoryItem } from "@/types/settings";

/** useDirectoryConfig hook 返回值 */
export interface UseDirectoryConfigResult {
  /** 目录项列表（含前端 id） */
  items: readonly DirectoryItem[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 新增一个空目录项（用户自定义，追加到末尾，立即落盘） */
  addItem: () => void;
  /** 删除指定 id 的目录项（预置项忽略，立即落盘） */
  removeItem: (id: string) => void;
  /** 更新指定 id 的目录项路径（立即落盘） */
  updatePath: (id: string, path: string) => void;
  /** 更新指定 id 的目录项名称（预置项忽略，立即落盘） */
  updateName: (id: string, name: string) => void;
  /** 删除全部用户自定义目录项（预置项保留，立即落盘） */
  clearUserItems: () => void;
}

/**
 * 生成唯一 id
 *
 * 优先用 crypto.randomUUID（Tauri WebView 安全上下文可用），
 * 异常时降级到时间戳 + 随机数组合，保证会话内唯一即可。
 *
 * @returns 唯一字符串
 */
function genId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * 把预置项与已加载项合并，确保预置项常驻且排首位
 *
 * - Store 中若已存在同名预置项，沿用其已选路径
 * - Store 中缺失的预置项自动补回（path 留空，待用户选择）
 * - 合并后顺序：预置项在前，用户自定义项按原序在后
 *
 * @param stored - 从 Store 读取的目录项（仅 name/path）
 * @returns 完整目录项数组（含 id 与 isPreset）
 */
function mergeWithPreset(
  stored: readonly { name: string; path: string }[],
): DirectoryItem[] {
  const preset: DirectoryItem[] = PRESET_DIRECTORY_ITEMS.map((p) => {
    // 同名项取已保存的路径，否则留空
    const matched = stored.find((s) => s.name === p.name);
    return {
      id: genId(),
      name: p.name,
      path: matched?.path ?? "",
      isPreset: true,
    };
  });

  // 用户自定义项：排除已并入预置项的同名项，保留其余
  const presetNames = new Set<string>(PRESET_DIRECTORY_ITEMS.map((p) => p.name));
  const userItems: DirectoryItem[] = stored
    .filter((s) => !presetNames.has(s.name))
    .map((s) => ({
      id: genId(),
      name: s.name,
      path: s.path,
      isPreset: false,
    }));

  return [...preset, ...userItems];
}

/**
 * 目录配置 hook
 *
 * - 挂载时异步从 Store 读取初始数据，期间 isLoading=true
 * - 加载完成后合并预置项（embedded-mcp-toolkit 等常驻首位）
 * - 增删改操作立即更新内存态，并异步落盘到 Store
 * - 写盘失败静默降级（不阻断 UI）
 *
 * @returns 列表状态与 mutator
 *
 * @example
 * const { items, isLoading, addItem, removeItem, updatePath } = useDirectoryConfig();
 */
export function useDirectoryConfig(): UseDirectoryConfigResult {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 首次挂载：异步加载 Store 数据并合并预置项
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readDirectoryConfig();
      if (cancelled) {
        return; // 组件已卸载，丢弃结果
      }
      setItems(mergeWithPreset(stored));
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 新增空目录项（用户自定义） */
  const addItem = useCallback((): void => {
    setItems((prev) => {
      const next = [...prev, { id: genId(), name: "", path: "", isPreset: false }];
      void writeDirectoryConfig(next);
      return next;
    });
  }, []);

  /** 删除指定 id 的目录项（预置项忽略） */
  const removeItem = useCallback((id: string): void => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      // 预置项不可删除
      if (!target || target.isPreset) {
        return prev;
      }
      const next = prev.filter((i) => i.id !== id);
      void writeDirectoryConfig(next);
      return next;
    });
  }, []);

  /**
   * 更新指定 id 的目录项路径
   *
   * 立即落盘。空路径合法（表示"新增但未填写"）。
   * 若该自定义项名称为空，则用路径 basename 自动填充名称并一并落盘，
   * 避免 Store 中存留 name 为空的"半成品"项。
   */
  const updatePath = useCallback((id: string, path: string): void => {
    setItems((prev) => {
      const next = prev.map((i) => {
        if (i.id !== id) {
          return i;
        }
        // 预置项名称固定；自定义项名称为空时由路径派生填充
        const shouldAutoName = !i.isPreset && i.name.trim() === "";
        return {
          ...i,
          path,
          name: shouldAutoName ? basename(path) : i.name,
        };
      });
      void writeDirectoryConfig(next);
      return next;
    });
  }, []);

  /** 更新指定 id 的目录项名称（预置项忽略） */
  const updateName = useCallback((id: string, name: string): void => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      // 预置项名称固定不可改
      if (!target || target.isPreset) {
        return prev;
      }
      const next = prev.map((i) => (i.id === id ? { ...i, name } : i));
      void writeDirectoryConfig(next);
      return next;
    });
  }, []);

  /** 删除全部用户自定义目录项（预置项保留） */
  const clearUserItems = useCallback((): void => {
    setItems((prev) => {
      const next = prev.filter((i) => i.isPreset);
      void writeDirectoryConfig(next);
      return next;
    });
  }, []);

  // useMemo 稳定返回引用，避免调用方多余重渲染
  return useMemo(
    () => ({
      items,
      isLoading,
      addItem,
      removeItem,
      updatePath,
      updateName,
      clearUserItems,
    }),
    [items, isLoading, addItem, removeItem, updatePath, updateName, clearUserItems],
  );
}
