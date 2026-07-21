/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : settings.ts (types)
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设置页相关类型定义（目录配置）
 * ======================================================
 */

/** 目录项（仅运行时使用，不入库） */
export interface DirectoryItem {
  /** 前端唯一标识（用于 React key，不入库；加载时由 crypto.randomUUID() 生成） */
  id: string;
  /**
   * 名称
   *
   * - 预置项（如 embedded-mcp-toolkit）固定，不可改
   * - 用户自定义项为空，展示时由路径 basename 派生
   */
  name: string;
  /** 目录路径（空字符串表示未填写） */
  path: string;
  /** 是否预置项（固定常驻、不可删除） */
  isPreset: boolean;
}

/**
 * 目录项的持久化结构
 *
 * 运行时的 DirectoryItem 含 id/isPreset 等仅前端使用的字段，
 * 入库时只保留 name 与 path。旧版本数据为 string[]（仅路径），
 * 由 store.ts 读取层做兼容迁移。
 */
export interface StoredDirectoryItem {
  /** 名称（空字符串表示用户自定义项，展示时由路径派生） */
  name: string;
  /** 目录路径 */
  path: string;
}

/**
 * 路径校验状态（判别联合）
 *
 * 用 status 字段区分四种态，便于 UI 区分"校验中"（可显示 spinner）
 * 与"未校验"（什么都不显示），以及穷尽性检查。
 */
export type DirectoryValidation =
  | { status: "idle" }      // 未校验（空路径、加载中或非 Tauri 环境）
  | { status: "checking" }  // 校验中（fs 调用进行中）
  | { status: "valid" }     // 目录存在
  | { status: "invalid" };  // 目录不存在或不可访问
