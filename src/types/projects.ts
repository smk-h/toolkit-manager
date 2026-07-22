/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : projects.ts (types)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目域类型定义（项目项、持久化结构、配置状态）
 * ======================================================
 */

/** 项目项（运行时使用，含前端字段） */
export interface ProjectItem {
  /** 前端唯一标识（crypto.randomUUID()，不入库，仅作 React key） */
  id: string;
  /** 项目目录路径（用户输入或选择，空字符串表示新增未填写） */
  path: string;
}

/**
 * 项目项持久化结构
 *
 * 入库只保留 path，运行时的 id 仅前端使用不落盘。
 * 当前需求无需为项目附带其他元数据（如名称、备注）。
 */
export interface StoredProjectItem {
  /** 项目目录路径 */
  path: string;
}

/**
 * 项目配置状态（判别联合，五态）
 *
 * 用 kind 字段穷尽分支，UI 按此分流徽章样式与配置按钮可用性。
 * toolkit 异常由页面级引导态（F5）拦截，不进入卡片状态机，
 * 故卡片层只面对 toolkit 正常前提下的 ok / not-configured / config-error 三态。
 *
 * - idle：空路径，未触发检测
 * - checking：检测进行中（防抖计时或 fs 调用中）
 * - ok：两文件齐备 + 字段正确 + toolkit 正常
 * - not-configured：文件缺失或字段缺失（toolkit 正常）
 * - config-error：toolkit 路径不存在或启动脚本不存在
 */
export type ProjectConfigStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok" }
  | { kind: "not-configured" }
  | { kind: "config-error" };
