/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : Header.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 顶部固定标题栏（含设备页/项目页新增入口）
 * ======================================================
 */

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_META } from "@/config/nav";
import type { TabId } from "@/config/nav";

/** Header 组件属性 */
export interface HeaderProps {
  /** 当前激活的标签（决定右侧操作区渲染内容） */
  activeTab: TabId;
  /** 新增设备点击回调（仅 devices tab 时按钮可见） */
  onAddDevice: () => void;
  /** 新增项目点击回调（仅 projects tab 时按钮可见） */
  onAddProject: () => void;
}

/**
 * 顶部固定标题栏
 *
 * - 固定定位（fixed），不随内容滚动
 * - 半透明背景 + 毛玻璃模糊
 * - 左侧显示应用名（品牌蓝）
 * - 右侧操作区：当前为设备 tab 时显示「新增设备」按钮，projects tab 时显示
 *   「新增项目」按钮（均 ghost 风格，悬浮橙色高亮），其余 tab 为空
 *
 * @param props - 组件属性
 * @returns 渲染后的标题栏元素
 */
export function Header({
  activeTab,
  onAddDevice,
  onAddProject,
}: HeaderProps): React.ReactElement {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-background/80 backdrop-blur-md"
    >
      <div className="flex h-full items-center justify-between px-6">
        <h1 className="text-lg font-semibold text-blue-500 dark:text-blue-400">
          {APP_META.name}
        </h1>
        <div>
          {/* 设备页显示新增入口；其余 tab 不渲染该按钮 */}
          {/* ghost 默认透明，与 DeviceCard 操作按钮一致；悬浮时橙色高亮 */}
          {activeTab === "devices" && (
            <Button
              onClick={onAddDevice}
              variant="ghost"
              size="sm"
              className="hover:bg-orange-500 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              新增设备
            </Button>
          )}
          {/* 项目页显示新增入口；与设备页按钮风格一致 */}
          {activeTab === "projects" && (
            <Button
              onClick={onAddProject}
              variant="ghost"
              size="sm"
              className="hover:bg-orange-500 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              新增项目
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
