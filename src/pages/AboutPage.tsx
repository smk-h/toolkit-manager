/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : AboutPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 关于页（含项目名 + 版本号）
 * ======================================================
 */

import { Info } from "lucide-react";

import { APP_META } from "@/config/nav";

/**
 * 关于页面
 *
 * 垂直水平居中展示：大图标 → 项目名 → 版本号 → 提示文案。
 * 项目名与版本号取自 APP_META（版本号来源于 package.json）。
 */
export function AboutPage(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Info className="h-16 w-16 text-muted-foreground/50" />
      <h2 className="mt-4 text-2xl font-semibold">{APP_META.name}</h2>
      <p className="mt-1 text-base text-muted-foreground">
        版本 {APP_META.version}
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        该功能正在开发中，敬请期待。
      </p>
    </div>
  );
}
