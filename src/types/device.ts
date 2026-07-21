/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : device.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备数据模型与状态/类型枚举
 * ======================================================
 */

/** 设备在线状态，决定徽章配色 */
export type DeviceStatus = "online" | "degraded" | "offline";

/** 设备类型，决定卡片左侧图标 */
export type DeviceType = "laptop" | "desktop" | "server" | "mobile";

/** 设备数据模型 */
export interface Device {
  id: string;             // 唯一标识
  name: string;           // 设备名称（主标题）
  type: DeviceType;       // 设备类型，决定图标
  status: DeviceStatus;   // 在线状态，决定徽章颜色
  ip: string;             // IP 地址（次级信息行）
  mac: string;            // MAC 地址（次级信息行）
  os: string;             // 操作系统（次级信息行）
  configSummary: string;  // 配置摘要（CPU/内存一句话，次级信息下方）
}
