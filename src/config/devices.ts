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

/**
 * 文件名非法字符集合（跨平台取并集）
 *
 * 覆盖 Windows（/ \\ : * ? " < > |）与 Unix（/）的限制，
 * 新建设备文件名不得包含其中任一字符，否则写文件会失败。
 */
export const INVALID_NAME_CHARS = [
  "/",
  "\\",
  ":",
  "*",
  "?",
  '"',
  "<",
  ">",
  "|",
] as const;

/**
 * 模板文件名（固定，不含扩展名）
 *
 * 新建设备以 `${DEVICES_SUBDIR}/${TEMPLATE_FILE_NAME}.yaml` 为蓝本，
 * 读取其原文做字段级替换后写入 `<设备名>.yaml`。
 */
export const TEMPLATE_FILE_NAME = "board-example" as const;

/**
 * 设备名校验结果（判别联合）
 *
 * valid 为 true 表示校验通过；为 false 时附具体原因文案，
 * 供 UI 层直接展示在输入框下方。
 */
export type DeviceNameValidation =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * 校验设备名是否合法
 *
 * 按顺序检查三项：空值 → 非法字符 → 重名，命中即返回。
 * 调用方据此控制输入框标红与「下一步」按钮可用性。
 *
 * @param name - 待校验的设备名
 * @param existingNames - 现有设备名集合（用于重名检测）
 * @returns 校验结果（判别联合，失败附原因文案）
 */
export function validateDeviceName(
  name: string,
  existingNames: readonly string[],
): DeviceNameValidation {
  // 空：要求用户输入
  if (name.trim() === "") {
    return { valid: false, reason: "请输入设备名" };
  }

  // 非法字符：含任一文件名非法字符即拒绝
  if (INVALID_NAME_CHARS.some((ch) => name.includes(ch))) {
    return {
      valid: false,
      reason: '设备名不能包含特殊字符：/ \\ : * ? " < > |',
    };
  }

  // 重名：与现有设备文件名冲突
  if (existingNames.includes(name)) {
    return { valid: false, reason: `设备名「${name}」已存在` };
  }

  return { valid: true };
}
