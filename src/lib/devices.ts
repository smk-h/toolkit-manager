/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : devices.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备数据读取与 yaml 解析（纯逻辑层，不依赖 React）
 * ======================================================
 */

import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { load } from "js-yaml";

import { DEVICES_SUBDIR } from "@/config/devices";
import type {
  AdbChannel,
  Device,
  DevicesStatus,
  SerialChannel,
  SshChannel,
} from "@/types/device";

/** yaml 文件扩展名集合 */
const YAML_EXTENSIONS = [".yaml", ".yml"] as const;

/**
 * 判断当前是否运行在 Tauri 环境
 *
 * 非 Tauri 环境（纯浏览器）调用 fs 插件会抛错，需降级为 error。
 *
 * @returns 是 Tauri 环境返回 true
 */
function isTauriEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window
  );
}

/**
 * 判断是否为 yaml 文件
 *
 * 按扩展名（小写）匹配 .yaml / .yml。
 *
 * @param fileName - 文件名
 * @returns 是 yaml 文件返回 true
 */
function isYamlFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return YAML_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 去掉文件扩展名作为设备名
 *
 * @param fileName - 含扩展名的文件名
 * @returns 去掉最后一个扩展名后的名称
 */
function stripExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

/**
 * SSH 通道是否已启用
 *
 * @param ssh - SSH 通道
 * @returns 存在且 host 不为 "none" 返回 true
 */
export function isSshEnabled(ssh: SshChannel | undefined): boolean {
  return !!ssh && ssh.host !== "none";
}

/**
 * Serial 通道是否已启用
 *
 * @param serial - Serial 通道
 * @returns 存在且 port 不为 "none" 返回 true
 */
export function isSerialEnabled(serial: SerialChannel | undefined): boolean {
  return !!serial && serial.port !== "none";
}

/**
 * ADB 通道是否已绑定具体设备
 *
 * @param adb - ADB 通道
 * @returns 存在且 serialNo 非空、非 "sn_none" 返回 true
 */
export function isAdbEnabled(adb: AdbChannel | undefined): boolean {
  return (
    !!adb &&
    !!adb.serialNo &&
    adb.serialNo !== "sn_none" &&
    adb.serialNo.trim() !== ""
  );
}

/**
 * 解析单个 yaml 文本为设备对象
 *
 * 只提取关心的通道字段，多余字段忽略；解析异常返回 null（由调用方跳过）。
 * rawYaml 始终保留原文，供复制与详情展示。
 *
 * @param name - 设备名（文件名去扩展名）
 * @param rawText - yaml 原始文本
 * @returns 解析成功的设备对象；解析失败返回 null
 */
function parseDevice(name: string, rawText: string): Device | null {
  try {
    const parsed = load(rawText);
    // yaml 顶层须为对象（含 adb/ssh/serial 通道）
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    return {
      name,
      ssh: (obj.ssh as SshChannel | undefined) ?? undefined,
      serial: (obj.serial as SerialChannel | undefined) ?? undefined,
      adb: (obj.adb as AdbChannel | undefined) ?? undefined,
      rawYaml: rawText,
    };
  } catch (error) {
    // 单文件解析失败（格式错误、编码异常）记录告警，返回 null 由上层跳过
    console.warn(`[devices] parse failed for "${name}":`, error);
    return null;
  }
}

/**
 * 读取并解析设备列表
 *
 * 流程：
 * 1. basePath 为空 → no-path
 * 2. 非 Tauri 环境 → error
 * 3. 列 devices 子目录，目录不存在 → dir-missing
 * 4. 逐个 yaml 文件读取并解析，单文件失败跳过
 * 5. 全部完成 → ready（含设备数组，可能为空）
 *
 * @param basePath - embedded-mcp-toolkit 根路径
 * @returns 加载状态（判别联合）
 */
export async function readDevices(basePath: string): Promise<DevicesStatus> {
  // 路径为空：未配置
  if (!basePath.trim()) {
    return { kind: "no-path" };
  }

  // 非 Tauri 环境：无法访问文件系统
  if (!isTauriEnv()) {
    return { kind: "error" };
  }

  // 拼接 devices 子目录（正斜杠在 Windows 下 Tauri fs 也能识别）
  const devicesDir = `${basePath.replace(/[\\/]+$/, "")}/${DEVICES_SUBDIR}`;

  // 列目录：失败（目录不存在、权限拒绝等）视为 dir-missing
  let entries;
  try {
    entries = await readDir(devicesDir);
  } catch (error) {
    console.warn("[devices] readDir failed:", error);
    return { kind: "dir-missing" };
  }

  // 过滤 yaml 文件，逐个读取解析
  const devices: Device[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !isYamlFile(entry.name)) {
      continue;
    }
    const filePath = `${devicesDir}/${entry.name}`;
    try {
      const text = await readTextFile(filePath);
      const device = parseDevice(stripExtension(entry.name), text);
      if (device) {
        devices.push(device);
      }
    } catch (error) {
      // 单文件读取失败：跳过该文件，继续其余
      console.warn(`[devices] readTextFile failed for "${entry.name}":`, error);
    }
  }

  return { kind: "ready", devices };
}
