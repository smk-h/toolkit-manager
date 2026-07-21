/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : devices.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备固定数据与类型→图标/状态→样式映射
 * ======================================================
 */

import {
  Laptop,
  Monitor,
  Server,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

import type { Device, DeviceStatus, DeviceType } from "@/types/device";

/** 设备类型到图标的映射（新增类型只需在此扩展） */
export const DEVICE_TYPE_ICON: Record<DeviceType, LucideIcon> = {
  laptop: Laptop,
  desktop: Monitor,
  server: Server,
  mobile: Smartphone,
};

/** 设备状态徽章的视觉样式 */
export interface DeviceStatusStyle {
  label: string;     // 中文文案（本章节硬编码，后续替换为 i18n key）
  dotClass: string;  // 状态圆点背景色 class
  bgClass: string;   // 徽章背景色 class
  textClass: string; // 文字色 class
}

/** 设备状态到徽章视觉样式的映射（绿/黄/红 三色方案，含 dark 变体） */
export const DEVICE_STATUS_STYLE: Record<DeviceStatus, DeviceStatusStyle> = {
  online: {
    label: "在线",
    dotClass: "bg-green-500",
    bgClass: "bg-green-500/10",
    textClass: "text-green-600 dark:text-green-400",
  },
  degraded: {
    label: "降级",
    dotClass: "bg-yellow-500",
    bgClass: "bg-yellow-500/10",
    textClass: "text-yellow-600 dark:text-yellow-400",
  },
  offline: {
    label: "离线",
    dotClass: "bg-red-500",
    bgClass: "bg-red-500/10",
    textClass: "text-red-600 dark:text-red-400",
  },
};

/**
 * 固定设备列表（占位数据）
 *
 * 覆盖 4 种设备类型与 3 种在线状态，字段对齐未来 Tauri 系统接口返回结构。
 * 本章节完全静态，运行时不可变。
 */
export const MOCK_DEVICES: readonly Device[] = [
  {
    id: "dev-001",
    name: "MacBook Pro",
    type: "laptop",
    status: "online",
    ip: "192.168.1.10",
    mac: "AA:BB:CC:00:00:01",
    os: "macOS 14.5",
    configSummary: "M3 Pro · 18GB",
  },
  {
    id: "dev-002",
    name: "Windows 工作站",
    type: "desktop",
    status: "online",
    ip: "192.168.1.11",
    mac: "AA:BB:CC:00:00:02",
    os: "Windows 11",
    configSummary: "i7-13700K · 32GB",
  },
  {
    id: "dev-003",
    name: "Ubuntu 构建服务器",
    type: "server",
    status: "degraded",
    ip: "192.168.1.20",
    mac: "AA:BB:CC:00:00:03",
    os: "Ubuntu 22.04",
    configSummary: "Ryzen 9 · 64GB",
  },
  {
    id: "dev-004",
    name: "测试服务器",
    type: "server",
    status: "offline",
    ip: "192.168.1.21",
    mac: "AA:BB:CC:00:00:04",
    os: "CentOS 7",
    configSummary: "Xeon E5 · 32GB",
  },
  {
    id: "dev-005",
    name: "iPhone 15",
    type: "mobile",
    status: "offline",
    ip: "192.168.1.30",
    mac: "AA:BB:CC:00:00:05",
    os: "iOS 17.5",
    configSummary: "A16 · 6GB",
  },
];
