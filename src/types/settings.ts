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
  /** 目录路径（空字符串表示未填写） */
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
