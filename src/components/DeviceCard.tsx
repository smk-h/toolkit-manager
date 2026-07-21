/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceCard.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备卡片组件（通道连接摘要 + 四操作按钮）
 * ======================================================
 */

import { Copy, Edit, Info, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatAdbSummary,
  formatSerialSummary,
  formatSshSummary,
} from "@/config/devices";
import type { Device } from "@/types/device";

/** DeviceCard 组件属性 */
export interface DeviceCardProps {
  /** 设备数据 */
  device: Device;
  /** 详情回调 */
  onDetail: (device: Device) => void;
  /** 复制回调 */
  onCopy: (device: Device) => void;
  /** 编辑回调（占位） */
  onEdit: (device: Device) => void;
  /** 删除回调（占位） */
  onDelete: (device: Device) => void;
}

/** 单个通道摘要项的展示配置 */
interface ChannelSummaryItem {
  /** 通道标签 */
  label: string;
  /** 连接摘要（空字符串表示未启用） */
  value: string;
}

/**
 * 设备卡片
 *
 * 展示设备名与已启用通信通道（SSH/Serial/ADB）的连接摘要，
 * 右侧操作区含「详情、复制、编辑、删除」四按钮，悬停时淡入并橙色高亮。
 *
 * @param props - 组件属性
 * @returns 渲染后的卡片元素
 */
export function DeviceCard({
  device,
  onDetail,
  onCopy,
  onEdit,
  onDelete,
}: DeviceCardProps): React.ReactElement {
  // 组装三个通道的摘要（未启用的返回空字符串，渲染时过滤）
  const summaries: ChannelSummaryItem[] = [
    { label: "SSH", value: formatSshSummary(device.ssh) },
    { label: "Serial", value: formatSerialSummary(device.serial) },
    { label: "ADB", value: formatAdbSummary(device.adb) },
  ];
  const activeSummaries = summaries.filter((s) => s.value !== "");

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 text-card-foreground transition-all duration-300 hover:border-blue-500/50 hover:shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 左：设备名 + 通道摘要 */}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base font-semibold leading-none">
            {device.name}
          </h3>
          {/* 已启用通道摘要 */}
          {activeSummaries.length > 0 ? (
            <p className="truncate text-sm text-muted-foreground">
              {activeSummaries.map((s) => `${s.label}: ${s.value}`).join("  ·  ")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/70">
              无已启用通道
            </p>
          )}
        </div>

        {/* 右：操作按钮区（默认隐藏，悬停/聚焦时淡入） */}
        <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 pointer-events-none transition-opacity duration-200 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
          <Button
            variant="ghost"
            size="icon"
            aria-label="详情"
            title="详情"
            onClick={() => onDetail(device)}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="复制"
            title="复制 yaml 全文"
            onClick={() => onCopy(device)}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="编辑"
            title="编辑"
            onClick={() => onEdit(device)}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="删除"
            title="删除"
            onClick={() => onDelete(device)}
            className="hover:bg-orange-500 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
