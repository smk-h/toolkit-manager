/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : SideNav.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 左侧导航栏
 * ======================================================
 */

import { NAV_ITEMS } from "@/config/nav";
import type { TabId } from "@/config/nav";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** SideNav 组件属性 */
export interface SideNavProps {
  /** 当前激活的标签 */
  activeTab: TabId;
  /** 切换标签的回调 */
  onSwitch: (tab: TabId) => void;
}

/**
 * 渲染单个导航项按钮
 *
 * @param item - 导航项配置
 * @param isActive - 是否激活
 * @param onSwitch - 点击回调
 */
function renderNavItem(
  item: (typeof NAV_ITEMS)[number],
  isActive: boolean,
  onSwitch: (tab: TabId) => void,
): React.ReactElement {
  const Icon = item.icon;

  return (
    <TooltipProvider key={item.id} delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSwitch(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-blue-500/10 text-blue-500 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {/* 激活态左侧竖条 */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-blue-500"
              />
            )}
            <Icon className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * 左侧导航栏
 *
 * - 固定宽度 56px（w-14），从标题栏下沿开始
 * - 顶部三项（设备/项目/设置）顶部对齐
 * - "关于"通过 mt-auto 贴底显示
 * - 每项支持 tooltip 显示功能名
 */
export function SideNav({
  activeTab,
  onSwitch,
}: SideNavProps): React.ReactElement {
  const topItems = NAV_ITEMS.slice(0, 3);
  const aboutItem = NAV_ITEMS[3];

  return (
    <nav
      className="fixed bottom-0 left-0 top-16 z-40 flex w-14 flex-col items-center border-r border-border bg-muted/30 py-4"
      aria-label="主导航"
    >
      {/* 顶部三项 */}
      <div className="flex flex-col items-center gap-2">
        {topItems.map((item) =>
          renderNavItem(item, item.id === activeTab, onSwitch),
        )}
      </div>

      {/* "关于"贴底 */}
      <div className="mt-auto">
        {renderNavItem(
          aboutItem,
          aboutItem.id === activeTab,
          onSwitch,
        )}
      </div>
    </nav>
  );
}
