/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : button.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: shadcn 风格 Button 基础组件（CVA 驱动 variants）
 * ======================================================
 */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Button 样式变体表
 *
 * 通过 class-variance-authority 组合 variant × size 生成最终 className。
 * 对齐 shadcn/ui 官方实现，icon 尺寸沿用 cc-switch 的 iconButtonClass（h-8 w-8 p-1）。
 */
export const buttonVariants = cva(
  // base：所有按钮共享的布局与交互样式
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      // variant：视觉风格变体
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // size：尺寸变体
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-8 w-8 p-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** Button 组件属性 */
export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /**
   * 是否将 props 合并到子元素（多态渲染）
   *
   * shadcn 官方实现依赖 @radix-ui/react-slot 支持 asChild，
   * 本项目为避免引入新依赖暂不实现该能力。
   * 传入 true 时仍渲染为普通 button（降级处理），
   * 待后续章节需要时再安装 @radix-ui/react-slot 补齐。
   */
  asChild?: boolean;
}

/**
 * 基础按钮组件
 *
 * 所有交互按钮的统一入口。通过 variant/size 控制样式，
 * 其余原生 button 属性全部透传。
 *
 * @param props - 组件属性，含 variant/size/asChild 与原生 button 属性
 * @returns 渲染后的 button 元素
 */
export function Button({
  variant,
  size,
  asChild,
  className,
  ...props
}: ButtonProps): React.ReactElement {
  // asChild 当前为降级实现：始终渲染 button，忽略其值。
  // 保留参数仅为维持类型签名稳定，避免未来接入 Slot 时改动调用点。
  void asChild;

  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
