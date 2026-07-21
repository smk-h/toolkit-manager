/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : nav.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 导航项类型定义与静态配置
 * ======================================================
 */

import type { LucideIcon } from "lucide-react";
import { Monitor, FolderKanban, Settings, Info } from "lucide-react";

import pkg from "../../package.json";

/** 功能标签唯一标识符 */
export type TabId = "devices" | "projects" | "settings" | "about";

/** 导航项接口 */
export interface NavItem {
  /** 唯一标识 */
  id: TabId;
  /** 显示名称（用于 Tooltip 与无障碍标签） */
  label: string;
  /** 图标组件 */
  icon: LucideIcon;
}

/** 应用元信息 */
export const APP_META = {
  name: "toolkit-manager",
  version: pkg.version,
} as const;

/** 当前应用版本号（从 package.json 注入） */
export const APP_VERSION: string = pkg.version;

/**
 * 导航项配置（顺序即展示顺序）
 *
 * 前三项（设备、项目、设置）顶部对齐；"关于"通过布局样式贴底显示，
 * 顺序仍保持数组中的位置。
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "devices", label: "设备", icon: Monitor },
  { id: "projects", label: "项目", icon: FolderKanban },
  { id: "settings", label: "设置", icon: Settings },
  { id: "about", label: "关于", icon: Info },
] as const;
