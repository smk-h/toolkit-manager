/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : input.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: shadcn 风格 Input 基础组件
 * ======================================================
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** Input 组件属性（继承原生 input） */
export type InputProps = React.ComponentProps<"input">;

/**
 * 基础输入框组件
 *
 * 对齐 shadcn/ui 官方实现，支持 forwardRef。
 * 通过 aria-invalid={true} 触发红边框（错误态），
 * 配合校验提示使用。
 *
 * @param props - 原生 input 属性
 * @returns 渲染后的 input 元素
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // 错误态：aria-invalid=true 时叠加红边框
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
