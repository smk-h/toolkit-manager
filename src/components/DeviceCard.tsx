/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceCard.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备卡片组件（视觉骨架移植自 cc-switch ProviderCard）
 * ======================================================
 */

import { Edit, Info, Trash2 } from "lucide-react";

import { DeviceStatusBadge } from "@/components/DeviceStatusBadge";
import { Button } from "@/components/ui/button";
import { DEVICE_TYPE_ICON } from "@/config/devices";
import { cn } from "@/lib/utils";
import type { Device } from "@/types/device";

/** DeviceCard 组件属性 */
export interface DeviceCardProps {
  device: Device;                         // 设备数据
  isSelected: boolean;                    // 是否选中
  onSelect: (device: Device) => void;     // 点击卡片（非按钮区域）选中回调
}

/**
 * 设备卡片
 *
 * 单张卡片的视觉与交互容器，包含：
 * - 左侧图标方块（随设备类型变化，悬停 scale-105）
 * - 主标题 + 状态徽章
 * - 次级信息（IP·MAC·OS）与配置摘要
 * - 右侧操作按钮区（默认隐藏，悬停淡入）
 *
 * 选中态：蓝色边框 + 左侧渐变背景层 + 阴影。
 * 点击卡片主体或按 Enter/Space 触发 onSelect；
 * 点击右侧操作按钮仅阻止冒泡（不触发选中），本章节无实际行为。
 *
 * @param props - 组件属性
 * @returns 渲染后的卡片 div 元素
 */
export function DeviceCard({
  device,
  isSelected,
  onSelect,
}: DeviceCardProps): React.ReactElement {
  const IconComponent = DEVICE_TYPE_ICON[device.type];

  /** 点击卡片主体，触发选中回调 */
  const handleCardClick = (): void => {
    onSelect(device);
  };

  /**
   * 键盘事件处理，Enter/Space 触发选中
   *
   * Space 需 preventDefault 避免触发页面滚动；
   * Enter 在 button 等元素上会触发 click，但卡片是 div，需手动处理。
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(device);
    }
  };

  /**
   * 操作按钮点击处理
   *
   * 阻止冒泡到卡片，避免误触发选中；本章节仅打日志占位，
   * 后续章节在此接入真实逻辑（编辑/删除/查看详情）。
   */
  const handleActionClick = (event: React.MouseEvent): void => {
    event.stopPropagation();
    // 占位：后续章节替换为真实回调
    console.log("[DeviceCard] action clicked:", device.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition-all duration-300",
        "bg-card text-card-foreground group cursor-pointer",
        "hover:border-blue-500/50 hover:shadow-sm",
        isSelected && "border-blue-500/60 shadow-sm shadow-blue-500/10",
      )}
    >
      {/* 选中态左侧渐变背景层（绝对定位，仅选中时显现） */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none transition-opacity duration-500",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />

      {/* 主内容（相对定位，避免被渐变层遮挡） */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 左：图标方块 + 标题徽章 + 次级信息 */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* 图标方块容器（悬停 scale-105 微动效） */}
          <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center border border-border group-hover:scale-105 transition-transform duration-300">
            <IconComponent className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            {/* 标题 + 状态徽章 */}
            <div className="flex flex-wrap items-center gap-2 min-h-7">
              <h3 className="text-base font-semibold leading-none">
                {device.name}
              </h3>
              <DeviceStatusBadge status={device.status} />
            </div>

            {/* 次级信息行：IP · MAC · OS */}
            <p className="text-sm text-muted-foreground truncate">
              {device.ip} · {device.mac} · {device.os}
            </p>

            {/* 配置摘要 */}
            <p className="text-xs text-muted-foreground/80 truncate">
              {device.configSummary}
            </p>
          </div>
        </div>

        {/* 右：操作按钮区（默认隐藏，悬停/聚焦时淡入） */}
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200">
          <Button
            variant="ghost"
            size="icon"
            aria-label="详情"
            onClick={handleActionClick}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="编辑"
            onClick={handleActionClick}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="删除"
            onClick={handleActionClick}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
