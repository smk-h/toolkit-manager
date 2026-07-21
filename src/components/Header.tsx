/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : Header.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 顶部固定标题栏
 * ======================================================
 */

import { APP_META } from "@/config/nav";

/**
 * 顶部固定标题栏
 *
 * - 固定定位（fixed），不随内容滚动
 * - 半透明背景 + 毛玻璃模糊
 * - 左侧显示应用名（品牌蓝）
 * - 右侧预留空白，后续章节可扩展
 */
export function Header(): React.ReactElement {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-md"
    >
      <div className="flex h-full items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-blue-500 dark:text-blue-400">
          {APP_META.name}
        </h1>
        <div>
          {/* 本期预留，后续章节可放置操作区 */}
        </div>
      </div>
    </header>
  );
}
