/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceStatusBadge.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备状态徽章（online/degraded/offline 三色 pill）
 * ======================================================
 */

import { cn } from "@/lib/utils";
import { DEVICE_STATUS_STYLE } from "@/config/devices";
import type { DeviceStatus } from "@/types/device";

/** DeviceStatusBadge 组件属性 */
export interface DeviceStatusBadgeProps {
  status: DeviceStatus;   // 设备状态
  className?: string;     // 附加 className（可选）
}

/**
 * 渲染设备状态徽章
 *
 * 根据 status 从 DEVICE_STATUS_STYLE 取对应配色，渲染为
 * pill 形状（圆角胶囊），内含一个状态圆点与文案。
 *
 * @param props - 组件属性
 * @returns 渲染后的 span 元素
 */
export function DeviceStatusBadge({
  status,
  className,
}: DeviceStatusBadgeProps): React.ReactElement {
  const style = DEVICE_STATUS_STYLE[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        style.bgClass,
        style.textClass,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("w-2 h-2 rounded-full", style.dotClass)}
      />
      <span>{style.label}</span>
    </span>
  );
}
