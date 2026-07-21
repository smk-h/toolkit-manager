/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : ProjectsPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 项目页（占位）
 * ======================================================
 */

import { FolderKanban } from "lucide-react";

import { PlaceholderPage } from "@/components/PlaceholderPage";

/** 项目管理页占位组件 */
export function ProjectsPage(): React.ReactElement {
  return (
    <PlaceholderPage
      icon={FolderKanban}
      title="项目管理"
      hint="该功能正在开发中，敬请期待。"
    />
  );
}
