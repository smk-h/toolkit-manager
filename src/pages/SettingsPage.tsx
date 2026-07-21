/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : SettingsPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设置页（占位）
 * ======================================================
 */

import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/PlaceholderPage";

/** 应用设置页占位组件 */
export function SettingsPage(): React.ReactElement {
  return (
    <PlaceholderPage
      icon={Settings}
      title="应用设置"
      hint="该功能正在开发中，敬请期待。"
    />
  );
}
