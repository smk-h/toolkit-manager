/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : projects.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目配置纯逻辑层（状态判定、command 拼接、字段级读写合并）
 * ======================================================
 */

import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

import {
  CLAUDE_DIR_NAME,
  CLAUDE_SETTINGS_FILENAME,
  CLAUDE_SETTINGS_SCHEMA_URL,
  MCP_CONFIG_FILENAME,
  MCP_SERVER_NAME,
  MCP_STARTUP_SCRIPT,
} from "@/config/projects";
import type { ProjectConfigStatus } from "@/types/projects";

/** .mcp.json 的运行时模型（仅关注本域操作的字段，其余字段透传） */
interface McpConfigFile {
  /** JSON Schema URL（可选，由配置按钮补全） */
  $schema?: string;
  /** server 名 → 启动配置 */
  mcpServers?: Record<string, { command?: string; [k: string]: unknown }>;
  /** 允许其他未知字段透传（字段保护） */
  [k: string]: unknown;
}

/** .claude/settings.local.json 的运行时模型 */
interface ClaudeSettingsFile {
  /** 启用的 mcp server 名列表 */
  enabledMcpjsonServers?: string[];
  /** 允许其他未知字段透传（字段保护） */
  [k: string]: unknown;
}

/**
 * 拼接 MCP 启动命令路径
 *
 * 将 toolkitPath 中的反斜杠统一为正斜杠并去除尾部斜杠，
 * 与 user.md 示例（E:/AI/embedded-mcp-toolkit/remote-start-mcp.bat）一致，
 * 避免 JSON 转义问题与混合分隔符。
 *
 * @param toolkitPath - embedded-mcp-toolkit 根路径（可能含 Windows 反斜杠）
 * @returns 形如 `E:/AI/.../remote-start-mcp.bat` 的命令字符串（纯正斜杠）
 */
export function buildMcpCommand(toolkitPath: string): string {
  // [\\/]+ 匹配连续的斜杠或反斜杠，统一压缩为单个正斜杠；
  // 再去掉可能的尾部斜杠
  const normalized = toolkitPath.replace(/[\\/]+/g, "/").replace(/\/+$/, "");
  return `${normalized}/${MCP_STARTUP_SCRIPT}`;
}

/**
 * 构建全新的 .mcp.json 默认内容
 *
 * 仅含 $schema 与空的 mcpServers，由调用方填入 server command。
 *
 * @returns 默认 mcp 配置对象
 */
export function buildDefaultMcpJson(): McpConfigFile {
  return {
    $schema: CLAUDE_SETTINGS_SCHEMA_URL,
    mcpServers: {},
  };
}

/**
 * 构建全新的 .claude/settings.local.json 默认内容
 *
 * 仅含空的 enabledMcpjsonServers，由调用方填入 server 名。
 *
 * @returns 默认 claude 配置对象
 */
export function buildDefaultClaudeSettings(): ClaudeSettingsFile {
  return {
    enabledMcpjsonServers: [],
  };
}

/**
 * 读取并解析 JSON 文件
 *
 * 文件不存在、读取失败、JSON 解析失败均返回 null，
 * 由调用方按"空对象"处理（用于字段级合并）。
 *
 * @param filePath - 文件绝对路径
 * @returns 解析后的对象；任何异常返回 null
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  if (!(await exists(filePath))) {
    return null;
  }
  try {
    const text = await readTextFile(filePath);
    return JSON.parse(text) as T;
  } catch (error) {
    // 文件损坏或非法 JSON：按 null 处理，触发降级
    console.warn("[projects] readJsonFile failed:", filePath, error);
    return null;
  }
}

/**
 * 判定单个项目的配置状态
 *
 * 检测顺序（任一层级失败立即返回对应状态）：
 * 1. 空路径 → idle
 * 2. toolkit 路径不存在 → config-error
 * 3. 启动脚本不存在 → config-error
 * 4. .mcp.json 缺失或 command 不符 → not-configured
 * 5. .claude/settings.local.json 缺失或未含 server 名 → not-configured
 * 6. 全满足 → ok
 *
 * spec N3：文件损坏/解析失败等异常统一降级为 not-configured，不抛错。
 *
 * @param projectPath - 项目目录路径
 * @param toolkitPath - embedded-mcp-toolkit 根路径
 * @returns 配置状态（判别联合）
 */
export async function detectProjectStatus(
  projectPath: string,
  toolkitPath: string,
): Promise<ProjectConfigStatus> {
  // 空路径：未触发检测
  if (!projectPath.trim() || !toolkitPath.trim()) {
    return { kind: "idle" };
  }

  try {
    // toolkit 路径不存在
    if (!(await exists(toolkitPath))) {
      return { kind: "config-error" };
    }
    // 启动脚本不存在
    const scriptPath = buildMcpCommand(toolkitPath);
    if (!(await exists(scriptPath))) {
      return { kind: "config-error" };
    }

    const expectedCommand = buildMcpCommand(toolkitPath);

    // 检查 .mcp.json：command 必须与期望值完全相等
    const mcpPath = await join(projectPath, MCP_CONFIG_FILENAME);
    const mcpConfig = await readJsonFile<McpConfigFile>(mcpPath);
    if (
      !mcpConfig ||
      !mcpConfig.mcpServers ||
      mcpConfig.mcpServers[MCP_SERVER_NAME]?.command !== expectedCommand
    ) {
      return { kind: "not-configured" };
    }

    // 检查 .claude/settings.local.json：enabledMcpjsonServers 须含 server 名
    const settingsPath = await join(
      projectPath,
      CLAUDE_DIR_NAME,
      CLAUDE_SETTINGS_FILENAME,
    );
    const claudeSettings =
      await readJsonFile<ClaudeSettingsFile>(settingsPath);
    if (
      !claudeSettings ||
      !Array.isArray(claudeSettings.enabledMcpjsonServers) ||
      !claudeSettings.enabledMcpjsonServers.includes(MCP_SERVER_NAME)
    ) {
      return { kind: "not-configured" };
    }

    return { kind: "ok" };
  } catch (error) {
    // 异常降级为 not-configured（spec N3）
    console.warn("[projects] detectProjectStatus failed:", error);
    return { kind: "not-configured" };
  }
}

/**
 * 为项目写入/修正 MCP 配置（字段级合并，不破坏既有字段）
 *
 * 处理顺序：
 * 1. 项目目录不存在则先创建（recursive）
 * 2. 读-改-写 .mcp.json：设置 mcpServers.embedded-board.command
 * 3. 创建 .claude 子目录（如缺失）
 * 4. 读-改-写 .claude/settings.local.json：
 *    enabledMcpjsonServers 去重追加 embedded-board
 *
 * 每个文件先读后改后写：读取失败按默认空对象处理。
 * 本函数不 try/catch 吞错，IO 异常向上抛由调用方处理（toast 报错）。
 *
 * @param projectPath - 项目目录路径（不存在则先创建）
 * @param toolkitPath - toolkit 根路径（用于拼接 command）
 * @throws 文件系统错误（权限拒绝、磁盘满等）
 */
export async function applyProjectConfig(
  projectPath: string,
  toolkitPath: string,
): Promise<void> {
  // 项目目录不存在则先创建（F4 边界：用户可能想先初始化再配置）
  if (!(await exists(projectPath))) {
    await mkdir(projectPath, { recursive: true });
  }

  const expectedCommand = buildMcpCommand(toolkitPath);

  // 处理 .mcp.json：字段级合并 command
  const mcpPath = await join(projectPath, MCP_CONFIG_FILENAME);
  const mcpConfig =
    (await readJsonFile<McpConfigFile>(mcpPath)) ?? buildDefaultMcpJson();
  if (!mcpConfig.mcpServers) {
    mcpConfig.mcpServers = {};
  }
  mcpConfig.mcpServers[MCP_SERVER_NAME] = {
    ...mcpConfig.mcpServers[MCP_SERVER_NAME],
    command: expectedCommand,
  };
  await writeTextFile(mcpPath, JSON.stringify(mcpConfig, null, 2));

  // 创建 .claude 子目录（如缺失）
  const claudeDir = await join(projectPath, CLAUDE_DIR_NAME);
  if (!(await exists(claudeDir))) {
    await mkdir(claudeDir, { recursive: true });
  }

  // 处理 .claude/settings.local.json：去重追加 server 名
  const settingsPath = await join(claudeDir, CLAUDE_SETTINGS_FILENAME);
  const claudeSettings =
    (await readJsonFile<ClaudeSettingsFile>(settingsPath)) ??
    buildDefaultClaudeSettings();
  if (!Array.isArray(claudeSettings.enabledMcpjsonServers)) {
    claudeSettings.enabledMcpjsonServers = [];
  }
  if (!claudeSettings.enabledMcpjsonServers.includes(MCP_SERVER_NAME)) {
    claudeSettings.enabledMcpjsonServers.push(MCP_SERVER_NAME);
  }
  await writeTextFile(settingsPath, JSON.stringify(claudeSettings, null, 2));
}
