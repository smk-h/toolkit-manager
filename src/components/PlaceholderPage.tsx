/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : PlaceholderPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 占位页面组件（设备/项目/设置共用）
 * ======================================================
 */

import type { LucideIcon } from "lucide-react";

/** PlaceholderPage 组件属性 */
export interface PlaceholderPageProps {
  /** 顶部大图标 */
  icon: LucideIcon;
  /** 页面标题 */
  title: string;
  /** 底部灰色提示文案 */
  hint: string;
}

/**
 * 占位页面
 *
 * 垂直水平居中展示：大图标 + 标题 + 提示文案。
 * 设备、项目、设置三个页面共用。
 *
 * @param props - 组件属性
 */
export function PlaceholderPage({
  icon: Icon,
  title,
  hint,
}: PlaceholderPageProps): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Icon className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="mt-4 text-xl font-medium">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
