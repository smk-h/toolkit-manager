/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : useToast.ts
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 轻量全局 toast 状态管理（模块级单例 + 订阅）
 * ======================================================
 */

import { useEffect, useState } from "react";

/** toast 类型，决定配色 */
export type ToastType = "info" | "success" | "error";

/** 单条 toast 数据 */
export interface ToastItem {
  /** 唯一标识 */
  id: number;
  /** 提示文案 */
  message: string;
  /** 类型（决定配色） */
  type: ToastType;
}

/** 默认自动消失时长（毫秒） */
const DEFAULT_DURATION_MS = 2500;

/** 模块级 toast 队列（单例，所有 useToast 调用方共享同一份） */
let toasts: ToastItem[] = [];
/** 订阅者集合（组件挂载时注册，状态变更时通知） */
const subscribers = new Set<(items: ToastItem[]) => void>();
/** 自增 id 计数器 */
let nextId = 1;

/**
 * 通知所有订阅者队列更新
 */
function notify(): void {
  const snapshot = [...toasts];
  subscribers.forEach((fn) => fn(snapshot));
}

/**
 * 移除指定 id 的 toast
 *
 * @param id - toast id
 */
function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

/**
 * 显示一条 toast
 *
 * @param message - 提示文案
 * @param type - 类型，默认 info
 * @param durationMs - 自动消失时长，默认 2500ms
 * @returns 该 toast 的 id（可用于提前 dismiss）
 */
function show(
  message: string,
  type: ToastType = "info",
  durationMs: number = DEFAULT_DURATION_MS,
): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  notify();
  // 到时自动移除
  setTimeout(() => {
    dismiss(id);
  }, durationMs);
  return id;
}

/** useToast hook 返回值 */
export interface UseToastResult {
  /** 当前 toast 队列（只读） */
  toasts: readonly ToastItem[];
  /** 显示 toast */
  show: typeof show;
  /** 移除指定 toast */
  dismiss: typeof dismiss;
}

/**
 * 订阅全局 toast 队列
 *
 * 多个组件调用时共享同一份队列状态；show/dismiss 为稳定引用。
 *
 * @returns 当前队列与操作方法
 */
export function useToast(): UseToastResult {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    // 注册订阅，队列变更时同步本地 state 触发重渲染
    subscribers.add(setItems);
    // 挂载即同步一次，避免错过订阅前的更新
    setItems(toasts);
    return () => {
      subscribers.delete(setItems);
    };
  }, []);

  return { toasts: items, show, dismiss };
}
