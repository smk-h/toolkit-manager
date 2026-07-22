/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : projects.ts (config)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目域常量（存储键名、MCP server 名、脚本名、文件路径）
 * ======================================================
 */

/**
 * 项目列表在 Store 中的独立键名
 *
 * 与 directory-config 平级（不嵌套），值为 {path}[]（见 StoredProjectItem）。
 * 平级键职责清晰，读写互不干扰。
 */
export const PROJECT_CONFIG_KEY = "project-config" as const;

/**
 * MCP server 名称（写入两个配置文件的 server 标识）
 *
 * 固定为 embedded-board，与 embedded-mcp-toolkit 工具包一一对应，
 * 无需用户输入，避免两个文件中名称不一致。
 */
export const MCP_SERVER_NAME = "embedded-board" as const;

/**
 * MCP 启动脚本文件名
 *
 * 固定为 remote-start-mcp.bat，位于 toolkit 根目录下，
 * command 由 ${toolkitPath}/${MCP_STARTUP_SCRIPT} 拼接。
 */
export const MCP_STARTUP_SCRIPT = "remote-start-mcp.bat" as const;

/**
 * embedded-mcp-toolkit 预置项名称
 *
 * 与 directory-config 的预置项 name 一致，用于从中取 toolkit 根路径。
 * 本域独立声明，避免与 devices 域耦合。
 */
export const TOOLKIT_PRESET_NAME = "embedded-mcp-toolkit" as const;

/**
 * 项目下 claude 配置子目录名
 */
export const CLAUDE_DIR_NAME = ".claude" as const;

/**
 * claude 配置文件名（位于 .claude 目录下）
 *
 * 通过 enabledMcpjsonServers 字段声明启用的 server 名称。
 */
export const CLAUDE_SETTINGS_FILENAME = "settings.local.json" as const;

/**
 * MCP 配置文件名（位于项目根目录）
 *
 * 通过 mcpServers.<server>.command 声明 server 启动命令。
 */
export const MCP_CONFIG_FILENAME = ".mcp.json" as const;

/**
 * claude-code-settings 的 JSON Schema URL
 *
 * 写入 .mcp.json 的 $schema 字段，提供编辑器校验支持。
 */
export const CLAUDE_SETTINGS_SCHEMA_URL =
  "https://json.schemastore.org/claude-code-settings.json" as const;
