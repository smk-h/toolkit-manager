/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : switch.tsx (ui)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: Radix Switch 拨动开关基础组件（移植自 cc-switch）
 * ======================================================
 */

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * 拨动开关基础组件
 *
 * 基于 Radix Switch 封装，提供受控/非受控两态拨动开关。
 * 开启态绿色（emerald）、关闭态灰色，圆点横向滑动过渡。
 * 样式移植自 cc-switch，保证视觉一致。
 *
 * 受控用法（checked + onCheckedChange）天然支持「取消回弹」：
 * onCheckedChange 触发后 checked 不立即改变，由父组件决定。
 *
 * @param props - Radix Switch 原生属性（forwardRef）
 * @returns 渲染后的拨动开关元素
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      // 开启态绿色、关闭态灰色（与 cc-switch 一致）
      "data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600",
      "data-[state=unchecked]:bg-gray-200 dark:data-[state=unchecked]:bg-gray-900",
      className,
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform dark:bg-gray-400",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
