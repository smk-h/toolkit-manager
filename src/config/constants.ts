/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : constants.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 应用级常量定义
 * ======================================================
 */

import type { TabId } from "@/config/nav";

/** localStorage key：持久化当前激活的标签 */
export const ACTIVE_TAB_STORAGE_KEY = "toolkit-manager-active-tab";

/** 默认标签：启动时若 localStorage 无合法值，则使用此值 */
export const DEFAULT_TAB: TabId = "devices";

/** 全部合法标签列表，用于校验 localStorage 读出的值 */
export const VALID_TABS: readonly TabId[] = [
  "devices",
  "projects",
  "settings",
  "about",
] as const;
