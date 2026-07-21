/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DevicesPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备页（占位）
 * ======================================================
 */

import { Monitor } from "lucide-react";

import { PlaceholderPage } from "@/components/PlaceholderPage";

/** 设备管理页占位组件 */
export function DevicesPage(): React.ReactElement {
  return (
    <PlaceholderPage
      icon={Monitor}
      title="设备管理"
      hint="该功能正在开发中，敬请期待。"
    />
  );
}
