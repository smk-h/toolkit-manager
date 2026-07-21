/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : utils.ts
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 通用工具函数
 * ======================================================
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 Tailwind CSS 类名
 *
 * 用于条件化拼接 className，同时解决 Tailwind class 冲突问题。
 *
 * @param inputs - 任意数量的 class 值（字符串、数组、对象等）
 * @returns 合并并去重后的 class 字符串
 *
 * @example
 * cn("px-2", isActive && "bg-blue-500", "px-4")  // "bg-blue-500 px-4"
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
