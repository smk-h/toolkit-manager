/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : ContentArea.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 右侧内容区（按 activeTab 分发页面）
 * ======================================================
 */

import { AnimatePresence, motion } from "framer-motion";

import type { TabId } from "@/config/nav";
import { DevicesPage } from "@/pages/DevicesPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AboutPage } from "@/pages/AboutPage";

/** ContentArea 组件属性 */
export interface ContentAreaProps {
  /** 当前激活的标签 */
  activeTab: TabId;
  /** 切换标签回调（透传给需要跳转的页面，如设备页引导态） */
  onSwitch: (tab: TabId) => void;
  /** 新增设备对话框受控开关（透传给设备页） */
  createOpen: boolean;
  /** 新增设备对话框关闭回调（透传给设备页） */
  onCreateClose: () => void;
}

/**
 * 根据 activeTab 返回对应页面元素
 *
 * @param activeTab - 当前标签
 * @param onSwitch - 切换标签回调（仅 devices 页需要跳转能力）
 * @param createOpen - 新增设备对话框开关（仅 devices 页使用）
 * @param onCreateClose - 新增设备对话框关闭回调
 * @returns 对应的页面 React 元素
 */
function renderPage(
  activeTab: TabId,
  onSwitch: (tab: TabId) => void,
  createOpen: boolean,
  onCreateClose: () => void,
): React.ReactElement {
  switch (activeTab) {
    case "devices":
      return (
        <DevicesPage
          onNavigateSettings={() => onSwitch("settings")}
          createOpen={createOpen}
          onCreateClose={onCreateClose}
        />
      );
    case "projects":
      return <ProjectsPage />;
    case "settings":
      return <SettingsPage />;
    case "about":
      return <AboutPage />;
    default: {
      // 理论上不可达：TabId 类型已限定为上述四个值
      // 返回设备页作为兜底，保证运行时健壮性
      return (
        <DevicesPage
          onNavigateSettings={() => onSwitch("settings")}
          createOpen={createOpen}
          onCreateClose={onCreateClose}
        />
      );
    }
  }
}

/**
 * 右侧内容区
 *
 * 按 activeTab 切换页面，使用 framer-motion 的 AnimatePresence 实现淡入淡出动画。
 * key 设为 activeTab，确保每次切换都重新挂载触发动画。
 */
export function ContentArea({
  activeTab,
  onSwitch,
  createOpen,
  onCreateClose,
}: ContentAreaProps): React.ReactElement {
  return (
    <main className="ml-14 mt-16 h-[calc(100vh-4rem)] overflow-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-full p-6 pb-10"
        >
          {renderPage(activeTab, onSwitch, createOpen, onCreateClose)}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
