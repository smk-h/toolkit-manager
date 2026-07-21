/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : devices.ts (config)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备相关常量与通道摘要格式化纯函数
 * ======================================================
 */

import type { AdbChannel, SerialChannel, SshChannel } from "@/types/device";

/**
 * 设备配置的预置项 name
 *
 * 与 settings 的 PRESET_DIRECTORY_ITEMS 中 embedded-mcp-toolkit 对应，
 * 数据层据此从目录配置中取该预置项的路径。
 */
export const PRESET_DEVICE_DIR_NAME = "embedded-mcp-toolkit" as const;

/**
 * 设备 yaml 所在子目录（相对 embedded-mcp-toolkit 根路径）
 *
 * 用正斜杠，跨平台路径拼接时由调用方处理分隔符。
 */
export const DEVICES_SUBDIR = ".embedded/configs/devices" as const;

/**
 * 脱敏占位符
 *
 * 列表场景下 password 等敏感字段统一显示为该字符，不暴露明文。
 */
export const MASKED_VALUE = "·" as const;

/**
 * 格式化 SSH 通道连接摘要
 *
 * 已启用返回 `user@host:port`（缺失字段按默认补齐），
 * 未启用（host 为 none 或缺失）返回空字符串，由调用方决定如何展示。
 *
 * @param ssh - SSH 通道，可为 undefined
 * @returns 连接摘要字符串；未启用返回空字符串
 */
export function formatSshSummary(ssh: SshChannel | undefined): string {
  if (!ssh || ssh.host === "none") {
    return "";
  }
  const host = ssh.host ?? "";
  const port = ssh.port ?? 22;
  const user = ssh.username ?? "";
  return `${user}@${host}:${port}`;
}

/**
 * 格式化 Serial 通道连接摘要
 *
 * 已启用返回 `port@baudRate`，未启用（port 为 none 或缺失）返回空字符串。
 *
 * @param serial - Serial 通道，可为 undefined
 * @returns 连接摘要字符串；未启用返回空字符串
 */
export function formatSerialSummary(serial: SerialChannel | undefined): string {
  if (!serial || serial.port === "none") {
    return "";
  }
  const port = serial.port ?? "";
  const baudRate = serial.baudRate ?? 115200;
  return `${port}@${baudRate}`;
}

/**
 * 格式化 ADB 通道摘要
 *
 * 已绑定具体设备返回序列号，未绑定（sn_none 或空）返回空字符串。
 *
 * @param adb - ADB 通道，可为 undefined
 * @returns 序列号字符串；未绑定返回空字符串
 */
export function formatAdbSummary(adb: AdbChannel | undefined): string {
  if (!adb || !adb.serialNo || adb.serialNo === "sn_none") {
    return "";
  }
  return adb.serialNo;
}
