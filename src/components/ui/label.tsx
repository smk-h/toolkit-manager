/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : label.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: shadcn 风格 Label 基础组件（原生 label 实现）
 * ======================================================
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** Label 组件属性（继承原生 label） */
export type LabelProps = React.ComponentProps<"label">;

/**
 * 基础标签组件
 *
 * shadcn 官方实现基于 @radix-ui/react-label，
 * 本章为避免引入新依赖，用原生 <label> + Tailwind 实现。
 * 通过 htmlFor 与 Input 的 id 关联，保证可访问性。
 *
 * @param props - 原生 label 属性
 * @returns 渲染后的 label 元素
 */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none",
          // 与 disabled 控件组合时降低不透明度
          "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";

export { Label };
