/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useProjects.ts
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目列表状态 hook（异步持久化到 Tauri Store）
 * ======================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { readProjectConfig, writeProjectConfig } from "@/lib/store";
import type { ProjectItem } from "@/types/projects";

/** useProjects hook 返回值 */
export interface UseProjectsResult {
  /** 项目项列表（含前端 id） */
  items: readonly ProjectItem[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 新增一个空项目项（追加末尾，立即落盘） */
  addItem: () => void;
  /** 更新指定 id 的项目路径（立即落盘） */
  updatePath: (id: string, path: string) => void;
  /** 删除指定 id 的项目项（仅清理记录，不触碰项目目录文件） */
  removeItem: (id: string) => void;
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
 * 项目列表状态 hook
 *
 * - 挂载时异步从 Store 读取初始数据，期间 isLoading=true
 * - 加载完成后注入前端 id
 * - 增删改操作立即更新内存态，并异步落盘到 Store（仅 path 入库）
 * - 写盘失败静默降级（不阻断 UI）
 *
 * 注意：本 hook 只管列表增删改与持久化，不管状态检测。
 * 状态检测由 ProjectCard 内部按 path 防抖触发。
 *
 * @returns 列表状态与 mutator
 *
 * @example
 * const { items, isLoading, addItem, updatePath, removeItem } = useProjects();
 */
export function useProjects(): UseProjectsResult {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 首次挂载：异步加载 Store 数据并注入前端 id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readProjectConfig();
      if (cancelled) {
        return; // 组件已卸载，丢弃结果
      }
      setItems(stored.map((s) => ({ id: genId(), path: s.path })));
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 新增空项目项（追加末尾） */
  const addItem = useCallback((): void => {
    setItems((prev) => {
      const next = [...prev, { id: genId(), path: "" }];
      void writeProjectConfig(next.map((i) => ({ path: i.path })));
      return next;
    });
  }, []);

  /** 更新指定 id 的项目路径 */
  const updatePath = useCallback((id: string, path: string): void => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, path } : i));
      void writeProjectConfig(next.map((i) => ({ path: i.path })));
      return next;
    });
  }, []);

  /**
   * 删除指定 id 的项目项
   *
   * 仅清理应用内记录与 settings.json 的 project-config，
   * 不删除/修改项目目录下的 .mcp.json 与 .claude/settings.local.json。
   */
  const removeItem = useCallback((id: string): void => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      void writeProjectConfig(next.map((i) => ({ path: i.path })));
      return next;
    });
  }, []);

  // useMemo 稳定返回引用，避免调用方多余重渲染
  return useMemo(
    () => ({
      items,
      isLoading,
      addItem,
      updatePath,
      removeItem,
    }),
    [items, isLoading, addItem, updatePath, removeItem],
  );
}
