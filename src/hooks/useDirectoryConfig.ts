/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useDirectoryConfig.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 目录配置状态 hook（异步持久化到 Tauri Store）
 * ======================================================
 */

import { useCallback, useEffect, useState } from "react";

import { readDirectoryConfig, writeDirectoryConfig } from "@/lib/store";
import type { DirectoryItem } from "@/types/settings";

/** useDirectoryConfig hook 返回值 */
export interface UseDirectoryConfigResult {
  /** 目录项列表（含前端 id） */
  items: readonly DirectoryItem[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 新增一个空目录项（追加到末尾，立即落盘） */
  addItem: () => void;
  /** 删除指定 id 的目录项（立即落盘） */
  removeItem: (id: string) => void;
  /** 更新指定 id 的目录项路径（立即落盘） */
  updatePath: (id: string, path: string) => void;
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
 * 目录配置 hook
 *
 * - 挂载时异步从 Store 读取初始数据，期间 isLoading=true
 * - 增删改操作立即更新内存态，并异步落盘到 Store
 * - 写盘失败静默降级（不阻断 UI）
 *
 * @returns 列表状态与三个 mutator
 *
 * @example
 * const { items, isLoading, addItem, removeItem, updatePath } = useDirectoryConfig();
 */
export function useDirectoryConfig(): UseDirectoryConfigResult {
  const [items, setItems] = useState<DirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 首次挂载：异步加载 Store 数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const paths = await readDirectoryConfig();
      if (cancelled) {
        return; // 组件已卸载，丢弃结果
      }
      setItems(paths.map((p) => ({ id: genId(), path: p })));
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 新增空目录项 */
  const addItem = useCallback((): void => {
    setItems((prev) => {
      const next = [...prev, { id: genId(), path: "" }];
      void writeDirectoryConfig(next.map((i) => i.path));
      return next;
    });
  }, []);

  /** 删除指定 id 的目录项 */
  const removeItem = useCallback((id: string): void => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      void writeDirectoryConfig(next.map((i) => i.path));
      return next;
    });
  }, []);

  /** 更新指定 id 的目录项路径 */
  const updatePath = useCallback((id: string, path: string): void => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, path } : i));
      void writeDirectoryConfig(next.map((i) => i.path));
      return next;
    });
  }, []);

  return { items, isLoading, addItem, removeItem, updatePath };
}
