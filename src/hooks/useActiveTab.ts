/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useActiveTab.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 标签状态持久化 hook
 * ======================================================
 */

import { useCallback, useState } from "react";

import {
  ACTIVE_TAB_STORAGE_KEY,
  DEFAULT_TAB,
  VALID_TABS,
} from "@/config/constants";
import type { TabId } from "@/config/nav";

/**
 * 判断标签 id 是否合法
 *
 * @param value - 待校验的值
 * @returns 是合法 TabId 返回 true，否则 false
 */
function isValidTab(value: unknown): value is TabId {
  return (
    typeof value === "string" &&
    (VALID_TABS as readonly string[]).includes(value)
  );
}

/**
 * 从 localStorage 读取初始标签
 *
 * 若存储的值不合法或不存在，回退到默认值 DEFAULT_TAB。
 *
 * @returns 初始标签 id
 */
function readInitialTab(): TabId {
  try {
    const stored = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return isValidTab(stored) ? stored : DEFAULT_TAB;
  } catch {
    // localStorage 不可用（隐私模式、SSR 等），使用默认值
    return DEFAULT_TAB;
  }
}

/**
 * 标签状态 hook，封装持久化逻辑
 *
 * - 初始化时从 localStorage 读取（带合法性校验）
 * - 切换时自动写回 localStorage
 * - 返回与 useState 一致的元组签名
 *
 * @returns [当前标签, 切换函数]
 *
 * @example
 * const [activeTab, setActiveTab] = useActiveTab();
 * setActiveTab("settings");
 */
export function useActiveTab(): readonly [TabId, (tab: TabId) => void] {
  const [activeTab, setActiveTabState] = useState<TabId>(readInitialTab);

  const setActiveTab = useCallback((tab: TabId): void => {
    setActiveTabState(tab);
    try {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab);
    } catch {
      // 写入失败（配额满、隐私模式等）静默降级，不影响 UI
    }
  }, []);

  return [activeTab, setActiveTab] as const;
}
