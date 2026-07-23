/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useDirectoryConfig.ts (hook)
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 目录配置 hook（薄消费者，转发到全局 Context）
 * ======================================================
 *
 * 状态逻辑已提升至 DirectoryConfigContext（src/context/DirectoryConfigContext.tsx），
 * 应用内只保留单例 state。本 hook 仅做一层转发，保留原函数签名与返回类型，
 * 使 5 个调用点（App / DevicesPage / ProjectsPage / SettingsPage / useDevices）
 * 的 import 与解构零改动即可共享同一份 state。
 */

import { useDirectoryConfigContext } from "@/context/DirectoryConfigContext";

/** useDirectoryConfig hook 返回值 */
export interface UseDirectoryConfigResult {
  /** 目录项列表（含前端 id） */
  items: readonly import("@/types/settings").DirectoryItem[];
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
 * 目录配置 hook（薄消费者）
 *
 * 转发到全局 DirectoryConfigContext。Provider 挂载在 main.tsx 最外层，
 * 故应用内任意组件调用本 hook 均共享同一份 state——SettingsPage 改路径后，
 * App 的 toolkitPath 立即同步，无需重挂载或手动刷新。
 *
 * @returns 共享的目录配置状态与 mutator
 *
 * @example
 * const { items, isLoading, addItem, removeItem, updatePath } = useDirectoryConfig();
 */
export function useDirectoryConfig(): UseDirectoryConfigResult {
  return useDirectoryConfigContext();
}
