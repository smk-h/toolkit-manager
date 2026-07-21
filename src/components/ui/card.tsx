/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : card.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: shadcn 风格 Card 容器族（基础库沉淀）
 * ======================================================
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/** Card 组件属性 */
export interface CardProps extends React.ComponentProps<"div"> {}

/** CardHeader 组件属性 */
export interface CardHeaderProps extends React.ComponentProps<"div"> {}

/** CardTitle 组件属性 */
export interface CardTitleProps extends React.ComponentProps<"div"> {}

/** CardDescription 组件属性 */
export interface CardDescriptionProps extends React.ComponentProps<"div"> {}

/** CardContent 组件属性 */
export interface CardContentProps extends React.ComponentProps<"div"> {}

/** CardFooter 组件属性 */
export interface CardFooterProps extends React.ComponentProps<"div"> {}

/**
 * 卡片容器
 *
 * 卡片族的最外层容器，提供圆角、边框、主题背景与阴影。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

/**
 * 卡片头部
 *
 * 容纳标题、描述等头部内容的垂直容器。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

/**
 * 卡片标题
 *
 * 加粗、紧凑字距的标题容器。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

/**
 * 卡片描述
 *
 * 紧跟标题的次级说明文字，使用 muted 文本色。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const CardDescription = React.forwardRef<
  HTMLDivElement,
  CardDescriptionProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * 卡片主内容区
 *
 * 承载卡片主要内容的内边距容器。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

/**
 * 卡片底部
 *
 * 用于放置操作按钮的底部容器。
 * @param props - div 原生属性
 * @returns 渲染后的 div 元素
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
