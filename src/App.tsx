/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : App.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 应用根组件（三栏布局 + 路由状态 + 全局 MCP 开关编排 + 手动刷新编排）
 * ======================================================
 */

import { useCallback, useEffect, useState } from "react";

import { ContentArea } from "@/components/ContentArea";
import { GlobalMcpConfirmDialog } from "@/components/GlobalMcpConfirmDialog";
import { Header } from "@/components/Header";
import { SideNav } from "@/components/SideNav";
import { ToastContainer } from "@/components/ui/toast";
import { PRESET_DEVICE_DIR_NAME } from "@/config/devices";
import { useActiveTab } from "@/hooks/useActiveTab";
import { useDirectoryConfig } from "@/hooks/useDirectoryConfig";
import { useToast } from "@/hooks/useToast";
import {
  detectGlobalMcp,
  disableGlobalMcp,
  enableGlobalMcp,
} from "@/lib/globalMcp";

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
 * - Header：顶部固定标题栏（含项目页全局 MCP 开关）
 * - SideNav：左侧导航
 * - ContentArea：右侧内容区
 *
 * 持有：
 * - activeTab 状态（通过 useActiveTab hook 持久化到 localStorage）
 * - 新增设备/项目对话框开关（Header 触发）
 * - 全局 MCP 开关状态与编排逻辑（确认框 + 文件操作）
 */
function App(): React.ReactElement {
  const [activeTab, setActiveTab] = useActiveTab();
  // 新增设备对话框开关：Header 按钮置 true，创建成功或取消时置 false
  const [createOpen, setCreateOpen] = useState(false);
  // 新增项目开关：Header 按钮置 true，触发一次 addItem 后置 false
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);

  // 全局 MCP 开关状态（唯一来源是 ~/.claude.json，不持久化到应用 settings.json）
  const [globalMcpChecked, setGlobalMcpChecked] = useState(false);
  // 手动刷新计数器：Header 按钮点击时递增，驱动当前页签重读外部配置
  const [refreshTick, setRefreshTick] = useState<number>(0);
  // 全局 MCP 确认对话框：null 关闭，"enable"/"disable" 表示待确认操作
  const [globalMcpConfirmAction, setGlobalMcpConfirmAction] = useState<
    "enable" | "disable" | null
  >(null);
  const { show } = useToast();

  // toolkit 路径（与设备页/项目页共用同一份 directory-config 预置项）
  const { items: dirItems, isLoading: dirLoading } = useDirectoryConfig();
  const presetItem = dirLoading
    ? undefined
    : dirItems.find((i) => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME);
  const toolkitPath = presetItem?.path ?? "";

  // 挂载时检测全局 MCP 初始状态（仅一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await detectGlobalMcp();
      if (cancelled) {
        return;
      }
      setGlobalMcpChecked(status.kind === "enabled");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * 全局 MCP 开关切换（Header 触发）
   *
   * 不立即改变 globalMcpChecked——先弹确认框，确认流程完成后才更新状态。
   * 取消时 Radix Switch 受控，checked 未变，视觉自然回弹。
   *
   * @param checked - 用户拨动的目标状态
   */
  const handleGlobalMcpToggle = useCallback((checked: boolean): void => {
    setGlobalMcpConfirmAction(checked ? "enable" : "disable");
  }, []);

  /**
   * 确认全局 MCP 操作（确认框「启用」/「关闭」触发）
   *
   * 按待确认操作执行文件写入/移除，成功后刷新状态并上报开关视觉。
   * 失败时状态不变（开关回弹），仅 toast 报错。
   *
   * 启用前校验 toolkitPath：预置项路径未配置时直接拦截并提示，
   * 避免向 ~/.claude.json 写入缺失前缀的残缺 command（/remote-start-mcp.bat）。
   * 校验失败不进 try/catch（非「操作失败」语义），由 finally 统一关闭确认框。
   */
  const handleGlobalMcpConfirm = useCallback(async (): Promise<void> => {
    if (!globalMcpConfirmAction) {
      return;
    }
    const action = globalMcpConfirmAction;
    // 空路径前置拦截：提示用户先去设备页配置 toolkit 路径
    if (action === "enable" && !toolkitPath.trim()) {
      show("请先在设备页配置 embedded-mcp-toolkit 路径", "error");
      setGlobalMcpConfirmAction(null);
      return;
    }
    try {
      if (action === "enable") {
        await enableGlobalMcp(toolkitPath);
      } else {
        await disableGlobalMcp();
      }
      // 刷新状态：以文件实际内容为准
      const status = await detectGlobalMcp();
      setGlobalMcpChecked(status.kind === "enabled");
      show(
        action === "enable" ? "已启用全局 MCP 配置" : "已关闭全局 MCP 配置",
        "success",
      );
    } catch (error) {
      console.warn("[App] global mcp operation failed:", error);
      show("全局 MCP 配置操作失败", "error");
    } finally {
      setGlobalMcpConfirmAction(null);
    }
  }, [globalMcpConfirmAction, toolkitPath, show]);

  /**
   * 手动刷新当前页签数据 + 全局 MCP 状态
   *
   * 递增 refreshTick 驱动当前页签重读外部配置文件（设备 YAML / 项目 MCP 状态），
   * 同时重读 ~/.claude.json 刷新全局 MCP 开关状态。
   * 全局 MCP 重读失败时静默降级，不阻断页面数据刷新。
   */
  const handleRefresh = useCallback(async (): Promise<void> => {
    setRefreshTick((t) => t + 1);
    try {
      const status = await detectGlobalMcp();
      setGlobalMcpChecked(status.kind === "enabled");
    } catch (error) {
      console.warn("[App] refresh global mcp failed:", error);
    }
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <Header
        activeTab={activeTab}
        onAddDevice={() => setCreateOpen(true)}
        onAddProject={() => setProjectCreateOpen(true)}
        globalMcpChecked={globalMcpChecked}
        onGlobalMcpToggle={handleGlobalMcpToggle}
        onRefresh={handleRefresh}
      />
      <SideNav activeTab={activeTab} onSwitch={setActiveTab} />
      <ContentArea
        activeTab={activeTab}
        onSwitch={setActiveTab}
        createOpen={createOpen}
        onCreateClose={() => setCreateOpen(false)}
        projectCreateOpen={projectCreateOpen}
        onProjectCreateClose={() => setProjectCreateOpen(false)}
        globalMcpChecked={globalMcpChecked}
        refreshTick={refreshTick}
      />
      <ToastContainer />
      {/* 全局 MCP 确认对话框（App 层统一编排） */}
      <GlobalMcpConfirmDialog
        open={globalMcpConfirmAction !== null}
        action={globalMcpConfirmAction ?? "enable"}
        onConfirm={handleGlobalMcpConfirm}
        onClose={() => setGlobalMcpConfirmAction(null)}
      />
    </div>
  );
}

export default App;
