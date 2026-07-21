/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : App.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 应用根组件（三栏布局 + 路由状态）
 * ======================================================
 */

import { useEffect } from "react";

import { ContentArea } from "@/components/ContentArea";
import { Header } from "@/components/Header";
import { SideNav } from "@/components/SideNav";
import { useActiveTab } from "@/hooks/useActiveTab";

/**
 * 判断当前目标是否为可编辑元素
 *
 * 用于键盘快捷键处理，避免在 input/textarea 中误触发。
 *
 * @param target - 事件目标
 * @returns 是可编辑元素返回 true
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

/**
 * 应用根组件
 *
 * 组装三大区块：
 * - Header：顶部固定标题栏
 * - SideNav：左侧导航
 * - ContentArea：右侧内容区
 *
 * 持有 activeTab 状态（通过 useActiveTab hook 持久化到 localStorage）。
 */
function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useActiveTab();

  // F6 可选：Ctrl/Cmd+, 跳转到设置页
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== ",") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setActiveTab("settings");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setActiveTab]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <SideNav activeTab={activeTab} onSwitch={setActiveTab} />
      <ContentArea activeTab={activeTab} />
    </div>
  );
}

export default App;
