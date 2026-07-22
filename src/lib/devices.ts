/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : devices.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备数据读取与 yaml 解析（纯逻辑层，不依赖 React）
 * ======================================================
 */

import { invoke } from "@tauri-apps/api/core";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { load } from "js-yaml";

import { DEVICES_SUBDIR, TEMPLATE_FILE_NAME } from "@/config/devices";
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
 * @param filePath - YAML 文件完整路径
 * @param rawText - yaml 原始文本
 * @returns 解析成功的设备对象；解析失败返回 null
 */
export function parseDevice(name: string, filePath: string, rawText: string): Device | null {
  try {
    const parsed = load(rawText);
    // yaml 顶层须为对象（含 adb/ssh/serial 通道）
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    return {
      name,
      filePath,
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
      const device = parseDevice(stripExtension(entry.name), filePath, text);
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

/**
 * YAML 文件中一行文本的解析结果（仅 scalar 行）
 */
export interface YamlLineEntry {
  /** 累积点分路径，如 ["ssh", "password"] */
  path: string[];
  /** 0-based 行号 */
  lineIndex: number;
  /** 前导空格数 */
  indent: number;
  /** 行中冒号前的 key 名 */
  key: string;
  /** 冒号后到行尾的原始文本 */
  valueRaw: string;
  /** 值内容在 rawLine 中的起始字符偏移 */
  valueStart: number;
}

/**
 * 解析 YAML 文本为行索引列表
 *
 * 逐行扫描，跟踪缩进级别来构建每个 scalar 字段的点分路径。
 * 仅含 scalar 行（key: value），跳过空行、纯注释行、container 行。
 *
 * @param yamlText - 原始 YAML 文本
 * @returns 行索引列表
 */
export function parseYamlLines(yamlText: string): YamlLineEntry[] {
  const lines = yamlText.split("\n");
  const entries: YamlLineEntry[] = [];
  // 缩进栈：记录当前路径及缩进级别
  const indentStack: Array<{ path: string[]; indent: number }> = [
    { path: [], indent: -1 },
  ];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const rawLine = lines[lineIndex];

    // 跳过空行与纯注释行
    if (rawLine.trim() === "" || rawLine.trim().startsWith("#")) {
      continue;
    }

    // 计算前导空格
    const indentMatch = rawLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // 回溯缩进栈到当前缩进级别
    while (indent <= indentStack[indentStack.length - 1].indent) {
      indentStack.pop();
    }

    // 匹配 key: value 或 key:
    const lineMatch = rawLine.match(
      /^(\s*)(\S[\w.-]*):(\s*)(.*)$/,
    );
    if (!lineMatch) {
      continue;
    }

    const key = lineMatch[2];
    const colonSpace = lineMatch[3];
    const valuePart = lineMatch[4].trimEnd();

    // 当前路径（父级路径）
    const currentPath = indentStack[indentStack.length - 1].path;

    if (valuePart === "" || valuePart.startsWith("#")) {
      // container 行（仅有 key:）或 key: #comment
      indentStack.push({ path: [...currentPath, key], indent });
      continue;
    }

    // scalar 行（key: value）
    const keyEndIndex = rawLine.indexOf(":");
    const valueStart = keyEndIndex + 1 + colonSpace.length;

    entries.push({
      path: [...currentPath, key],
      lineIndex,
      indent,
      key,
      valueRaw: valuePart,
      valueStart,
    });
  }

  return entries;
}

/**
 * 对单行 YAML 文本做值替换
 *
 * 保留前导空格和 key，仅替换值部分。
 * undefined 时返回空字符串（删除字段）。
 * 保留原值的引号风格（无引号 / 单引号 / 双引号）。
 *
 * @param rawLine - 原始行文本
 * @param newValue - 新值；undefined 表示删除该行
 * @returns 替换后的行文本
 */
export function replaceYamlFieldValue(
  rawLine: string,
  newValue: string | number | undefined,
): string {
  if (newValue === undefined) {
    return "";
  }

  const colonIndex = rawLine.indexOf(":");
  if (colonIndex === -1) {
    return rawLine;
  }

  const keyPart = rawLine.slice(0, colonIndex + 1);
  const afterColon = rawLine.slice(colonIndex + 1);
  const spaceMatch = afterColon.match(/^(\s*)/);
  const spaces = spaceMatch ? spaceMatch[1] : "";
  const trimmedValue = afterColon.trim();

  const valueStr = String(newValue);

  // 检测原值引号风格并套用
  let formattedValue: string;
  if (trimmedValue.startsWith("'")) {
    formattedValue = `'${valueStr.replace(/'/g, "\\'")}'`;
  } else if (trimmedValue.startsWith('"')) {
    formattedValue = `"${valueStr.replace(/"/g, '\\"')}"`;
  } else {
    formattedValue = valueStr;
  }

  return `${keyPart}${spaces}${formattedValue}`;
}

/**
 * 对 YAML 文本做字段级替换，返回替换后的文本（不写文件）
 *
 * 解析行索引 → 逐项查找目标行 → 调用 replaceYamlFieldValue 替换。
 * 跳过值未实际变化的字段；从后往前替换避免行号偏移。
 * 抽取为私有函数，供编辑保存与模板创建复用。
 *
 * @param rawText - 原始 YAML 文本
 * @param updates - 点分路径 → 新值的映射（undefined 表示删除字段）
 * @returns 替换后的 YAML 文本；无任何变更时与原文相同
 */
function applyFieldUpdates(
  rawText: string,
  updates: Record<string, string | number | undefined>,
): string {
  const lines = rawText.split("\n");
  const index = parseYamlLines(rawText);

  // 按行号收集变更（从后往前替换，避免行号偏移）
  const changes: Array<{ lineIndex: number; newLine: string }> = [];

  for (const [fieldPath, newValue] of Object.entries(updates)) {
    // 找到匹配的行
    const pathSegments = fieldPath.split(".");
    const entry = index.find(
      (e) =>
        e.path.length === pathSegments.length &&
        e.path.every((seg, i) => seg === pathSegments[i]),
    );
    if (!entry) {
      console.warn(
        `[devices] field "${fieldPath}" not found in YAML, skipping`,
      );
      continue;
    }

    const oldRaw = entry.valueRaw;
    const newStr = newValue !== undefined ? String(newValue) : undefined;

    // 跳过值未变的字段
    if (newStr === oldRaw) {
      continue;
    }

    const newLine = replaceYamlFieldValue(lines[entry.lineIndex], newValue);
    changes.push({ lineIndex: entry.lineIndex, newLine });
  }

  // 从后往前替换，避免行号偏移
  changes.sort((a, b) => b.lineIndex - a.lineIndex);
  for (const { lineIndex, newLine } of changes) {
    lines[lineIndex] = newLine;
  }

  return lines.join("\n");
}

/**
 * 编辑保存：以文本级字段替换方式更新 YAML 文件
 *
 * 1. 读取原始 YAML 文本
 * 2. 用 applyFieldUpdates() 做文本替换
 * 3. 有实际变更才写回原文件
 *
 * 若所有字段值均未实际变更（update 中的值与原文一致），不触发写入。
 *
 * @param filePath - YAML 文件完整路径
 * @param updates - 点分路径 → 新值的映射
 * @returns 修改后的 YAML 文本
 */
export async function updateDeviceYaml(
  filePath: string,
  updates: Record<string, string | number | undefined>,
): Promise<string> {
  // 读取原始文本
  const rawText = await readTextFile(filePath);
  const newText = applyFieldUpdates(rawText, updates);

  // 有实际变更才写入
  if (newText !== rawText) {
    await writeTextFile(filePath, newText);
  }

  return newText;
}

/**
 * 从模板创建新设备
 *
 * 1. 读取模板 `${devicesDir}/${TEMPLATE_FILE_NAME}.yaml` 的原始文本
 * 2. 对用户修改的字段做文本级替换（复用 applyFieldUpdates）
 * 3. 将替换后的文本写入 `${devicesDir}/${name}.yaml`
 *
 * 模板读取失败（文件不存在/损坏）或写入失败时抛错，由调用方捕获后 toast 提示。
 * fieldUpdates 为空时直接拷贝模板原文（用户未修改任何字段）。
 *
 * @param devicesDir - 设备目录完整路径（末尾不带分隔符）
 * @param name - 新设备名（已通过校验：无非法字符、无重名）
 * @param fieldUpdates - 用户修改的字段点分路径 → 新值映射（未修改字段不传入）
 * @returns 新设备的完整文件路径
 * @throws 模板读取失败或文件写入失败时抛出底层错误
 */
export async function createDeviceFromTemplate(
  devicesDir: string,
  name: string,
  fieldUpdates: Record<string, string | number | undefined>,
): Promise<string> {
  // 读取模板原文（失败由调用方 toast）
  const templatePath = `${devicesDir}/${TEMPLATE_FILE_NAME}.yaml`;
  const templateText = await readTextFile(templatePath);

  // 用户未改任何字段：直接拷贝模板原文
  const newText =
    Object.keys(fieldUpdates).length > 0
      ? applyFieldUpdates(templateText, fieldUpdates)
      : templateText;

  // 写入新设备文件（失败由调用方 toast）
  const targetPath = `${devicesDir}/${name}.yaml`;
  await writeTextFile(targetPath, newText);

  return targetPath;
}

/**
 * 删除设备：将 YAML 文件移入 OS 回收站
 *
 * @param filePath - YAML 文件完整路径
 */
export async function trashDeviceFile(filePath: string): Promise<void> {
  await invoke("trash_file", { path: filePath });
}
