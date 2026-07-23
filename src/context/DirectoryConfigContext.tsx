/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DirectoryConfigContext.tsx
 * Author     : sumu
 * Date       : 2026/07/23
 * Description: 目录配置全局 Context（单例共享 state，替代各组件独立副本）
 * ======================================================
 *
 * 背景：原 useDirectoryConfig 用组件本地 useState，App / DevicesPage /
 * ProjectsPage / SettingsPage / useDevices 五处各持一份独立副本。唯一修改方
 * SettingsPage 改路径后，App（不卸载、不响应刷新）的 toolkitPath 永不更新，
 * 导致首次配置路径后全局 MCP 仍判 toolkitPath 为空。
 *
 * 方案：将状态逻辑提升为 Context Provider，挂在 main.tsx 最外层。所有消费者
 * 通过 useDirectoryConfigContext 共享同一份 state；SettingsPage 的 mutator
 * 更新共享 state 后，App 的 toolkitPath 立即重算。
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { PRESET_DIRECTORY_ITEMS } from "@/config/settings";
import { basename } from "@/lib/path";
import { readDirectoryConfig, writeDirectoryConfig } from "@/lib/store";
import type { DirectoryItem } from "@/types/settings";

import type { UseDirectoryConfigResult } from "@/hooks/useDirectoryConfig";

/** 目录配置 Context（持有单例 state 与 mutator） */
const DirectoryConfigContext = createContext<UseDirectoryConfigResult | null>(
  null,
);

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
 * 目录配置 Context 的 Provider 组件
 *
 * 挂载在应用最外层（main.tsx 内 StrictMode 下、App 外），持有唯一的
 * 目录配置 state。子树内任意消费者（useDirectoryConfigContext）共享此 state，
 * 任一处 mutator 触发更新后，全应用立即看到新值。
 *
 * @param props - children 为待渲染子树
 * @returns Provider 包裹的子树
 */
export function DirectoryConfigProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
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
  const value = useMemo<UseDirectoryConfigResult>(
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

  return (
    <DirectoryConfigContext.Provider value={value}>
      {children}
    </DirectoryConfigContext.Provider>
  );
}

/**
 * 目录配置 Context 消费者 hook
 *
 * 必须在 DirectoryConfigProvider 子树内调用。若在 Provider 外调用（context
 * 为 null），抛错以暴露挂载缺失，避免静默拿到 undefined 导致后续 NPE。
 *
 * @returns 共享的目录配置 state 与 mutator
 * @throws 在 Provider 外调用时抛出
 */
export function useDirectoryConfigContext(): UseDirectoryConfigResult {
  const ctx = useContext(DirectoryConfigContext);
  if (ctx === null) {
    throw new Error(
      "useDirectoryConfigContext 必须在 DirectoryConfigProvider 内调用",
    );
  }
  return ctx;
}
