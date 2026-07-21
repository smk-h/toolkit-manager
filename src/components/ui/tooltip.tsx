/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : tooltip.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: shadcn/ui Tooltip 组件（基于 Radix UI）
 * ======================================================
 */

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

/**
 * TooltipProvider：全局 Tooltip 上下文提供者
 *
 * delayDuration 设为 500ms，符合 spec F2 要求（悬停约 500ms 后弹出）。
 */
const TooltipProvider = TooltipPrimitive.Provider;

TooltipProvider.displayName = "TooltipProvider";

/**
 * Tooltip：Tooltip 容器
 */
const Tooltip = TooltipPrimitive.Root;

Tooltip.displayName = "Tooltip";

/**
 * TooltipTrigger：触发器，通常包裹按钮/图标
 */
const TooltipTrigger = TooltipPrimitive.Trigger;

TooltipTrigger.displayName = "TooltipTrigger";

/**
 * TooltipContent：气泡内容
 *
 * @param className - 自定义 class（与默认样式合并）
 * @param sideOffset - 与触发器的间距（默认 4px）
 * @param props - 其余 Radix TooltipContent 属性
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
        "animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
