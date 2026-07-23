/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : globalMcp.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 全局 MCP 配置纯逻辑层（~/.claude.json 检测/写入/移除）
 * ======================================================
 */

import { homeDir, join } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import { MCP_SERVER_NAME } from "@/config/projects";
import { buildMcpCommand } from "@/lib/projects";

/** 全局 MCP 配置文件名（位于用户主目录下） */
const CLAUDE_GLOBAL_FILENAME = ".claude.json";

/**
 * 全局 MCP 配置状态（判别联合）
 *
 * - unknown：未检测 / 加载中 / 非 Tauri 环境
 * - enabled：~/.claude.json 含 mcpServers.embedded-board
 * - disabled：不含
 */
export type GlobalMcpStatus =
  | { kind: "unknown" }
  | { kind: "enabled" }
  | { kind: "disabled" };

/** ~/.claude.json 的运行时模型（仅关注 mcpServers，其余字段透传） */
interface ClaudeGlobalConfig {
  /** server 名 → 启动配置 */
  mcpServers?: Record<string, { command?: string; [k: string]: unknown }>;
  /** 允许其他未知字段透传（字段保护） */
  [k: string]: unknown;
}

/**
 * 获取 ~/.claude.json 的绝对路径
 *
 * 使用 homeDir 拼接，跨平台（Win: C:\Users\xxx\.claude.json）。
 *
 * @returns 配置文件绝对路径
 */
export async function getClaudeGlobalConfigPath(): Promise<string> {
  const home = await homeDir();
  return join(home, CLAUDE_GLOBAL_FILENAME);
}

/**
 * 读取并解析 ~/.claude.json
 *
 * 文件不存在或解析失败均返回空对象 {}，由调用方按"无配置"处理（spec N2 降级）。
 *
 * @returns 解析后的配置对象；任何异常返回 {}
 */
async function readGlobalConfig(): Promise<ClaudeGlobalConfig> {
  const filePath = await getClaudeGlobalConfigPath();
  if (!(await exists(filePath))) {
    return {};
  }
  try {
    const text = await readTextFile(filePath);
    const parsed = JSON.parse(text);
    // 仅当解析为对象时返回，否则降级为空
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as ClaudeGlobalConfig;
    }
    return {};
  } catch (error) {
    console.warn("[globalMcp] readGlobalConfig failed:", error);
    return {};
  }
}

/**
 * 检测全局 MCP 是否已启用
 *
 * 判定依据：mcpServers 是否含 embedded-board。
 * 不校验 command 正确性——开关语义只管"有没有"，开启时无条件用正确值覆盖。
 *
 * @returns 配置状态（enabled / disabled / unknown）
 */
export async function detectGlobalMcp(): Promise<GlobalMcpStatus> {
  try {
    const config = await readGlobalConfig();
    if (config.mcpServers && config.mcpServers[MCP_SERVER_NAME]) {
      return { kind: "enabled" };
    }
    return { kind: "disabled" };
  } catch (error) {
    // 异常降级为 unknown（spec N3）
    console.warn("[globalMcp] detectGlobalMcp failed:", error);
    return { kind: "unknown" };
  }
}

/**
 * 启用全局 MCP：写入 mcpServers.embedded-board.command（字段级合并）
 *
 * 读取已有配置后合并写入，不破坏其他 server 与顶层字段。
 * command 复用 buildMcpCommand（正斜杠归一）。
 * 本函数不 try/catch 吞错，IO 异常向上抛由调用方处理。
 *
 * toolkitPath 为空时直接抛错——否则 buildMcpCommand 会拼出
 * `/remote-start-mcp.bat` 这样缺失前缀的残缺 command 写入配置文件，
 * 与项目级 detectProjectStatus 的空路径语义对齐。
 *
 * @param toolkitPath - embedded-mcp-toolkit 根路径
 * @throws toolkitPath 为空（参数错误）或文件系统错误（权限拒绝、磁盘满等）
 */
export async function enableGlobalMcp(toolkitPath: string): Promise<void> {
  // 空路径守卫：避免写出 /remote-start-mcp.bat 残缺 command
  if (!toolkitPath.trim()) {
    throw new Error("toolkitPath 为空，无法生成 MCP command");
  }
  const config = await readGlobalConfig();
  if (!config.mcpServers) {
    config.mcpServers = {};
  }
  config.mcpServers[MCP_SERVER_NAME] = {
    command: buildMcpCommand(toolkitPath),
  };
  await writeTextFile(
    await getClaudeGlobalConfigPath(),
    JSON.stringify(config, null, 2),
  );
}

/**
 * 禁用全局 MCP：移除 mcpServers.embedded-board（仅删该 key）
 *
 * 读取已有配置后删除目标 server，不碰其他 server 与顶层字段。
 * 本函数不 try/catch 吞错，IO 异常向上抛由调用方处理。
 *
 * @throws 文件系统错误（权限拒绝、磁盘满等）
 */
export async function disableGlobalMcp(): Promise<void> {
  const config = await readGlobalConfig();
  if (config.mcpServers && config.mcpServers[MCP_SERVER_NAME]) {
    delete config.mcpServers[MCP_SERVER_NAME];
  }
  await writeTextFile(
    await getClaudeGlobalConfigPath(),
    JSON.stringify(config, null, 2),
  );
}
