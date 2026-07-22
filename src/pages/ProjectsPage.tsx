/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : ProjectsPage.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目管理页（项目级 MCP 配置 + 引导态 + 手动刷新透传）
 * ======================================================
 */

import { useCallback, useEffect } from "react";

import { open } from "@tauri-apps/plugin-dialog";
import { Settings } from "lucide-react";

import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { PRESET_DEVICE_DIR_NAME } from "@/config/devices";
import { useDirectoryConfig } from "@/hooks/useDirectoryConfig";
import { useProjects } from "@/hooks/useProjects";
import type { ProjectItem } from "@/types/projects";

/** ProjectsPage 组件属性 */
export interface ProjectsPageProps {
  /** 跳转到设置页（引导态按钮触发） */
  onNavigateSettings: () => void;
  /** 新增项目受控开关（由 Header 按钮经 App 控制，触发一次 addItem） */
  createOpen: boolean;
  /** 新增项目开关关闭回调 */
  onCreateClose: () => void;
  /**
   * 全局 MCP 是否已启用（由 App 层持有，透传给 ProjectCard 联动禁用配置按钮）
   */
  globalMcpChecked: boolean;
  /** 刷新计数器，透传给 ProjectCard 作为 refreshKey */
  refreshTick: number;
}

/**
 * 项目管理页
 *
 * 数据流：
 * - useDirectoryConfig 取 toolkit 预置项路径（toolkit 为空/不存在 → 引导态）
 * - useProjects 取项目列表（toolkit 正常 → 渲染卡片列表）
 * - createOpen 由 Header「新增项目」触发，置 true 时 addItem 一次并关闭
 * - globalMcpChecked 由 App 层透传，仅用于联动禁用项目卡片配置按钮
 *   （全局开关的编排逻辑在 App 层，本组件不参与）
 *
 * @param props - 组件属性
 * @returns 渲染后的页面元素
 */
export function ProjectsPage({
  onNavigateSettings,
  createOpen,
  onCreateClose,
  globalMcpChecked,
  refreshTick,
}: ProjectsPageProps): React.ReactElement {
  const { items, isLoading, addItem, updatePath, removeItem } = useProjects();
  const { items: dirItems, isLoading: dirLoading } = useDirectoryConfig();

  // toolkit 预置项路径（与设备页共用同一份 directory-config）
  const presetItem = dirLoading
    ? undefined
    : dirItems.find((i) => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME);
  const toolkitPath = presetItem?.path ?? "";

  /**
   * 打开系统目录选择器并填充到指定项目
   *
   * 用户取消（返回 null）或异常时静默处理。选中后通过 updatePath 即时保存。
   *
   * @param id - 项目项 id
   */
  const handlePickDirectory = useCallback(
    async (id: string): Promise<void> => {
      try {
        const selected = await open({
          directory: true,
          title: "选择项目目录",
        });
        if (typeof selected === "string") {
          updatePath(id, selected);
        }
      } catch (error) {
        // 对话框异常静默降级
        console.warn("[ProjectsPage] open directory failed:", error);
      }
    },
    [updatePath],
  );

  /**
   * 计算指定项目路径是否与其它项目重复
   *
   * 跨项比对需在页面层完成（卡片层只能感知自身）。
   * 空路径不参与比对。
   *
   * @param item - 目标项目项
   * @returns 重复返回 true
   */
  const isDuplicatePath = useCallback(
    (item: ProjectItem): boolean => {
      if (!item.path.trim()) {
        return false;
      }
      return (
        items.filter((i) => i.path.trim() !== "" && i.path === item.path)
          .length > 1
      );
    },
    [items],
  );

  // createOpen 由 Header 触发：置 true 时追加一项并立即关闭信号
  // 项目卡片本身就是路径输入框，无需两阶段对话框（比设备页更轻量）
  useEffect(() => {
    if (createOpen) {
      addItem();
      onCreateClose();
    }
  }, [createOpen, addItem, onCreateClose]);

  // 页面加载状态：目录配置或项目列表任一未就绪
  const isPageLoading = dirLoading || isLoading;

  // toolkit 路径为空：引导态（F5）
  const isToolkitMissing = !dirLoading && !toolkitPath.trim();

  return (
    <div className="space-y-6">
      {/* 标题区：仅非引导态显示总数 */}
      {!isPageLoading && !isToolkitMissing && (
        <div>
          <h2 className="text-xl font-semibold">项目管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {items.length} 个项目 · 管理项目级 MCP 配置
          </p>
        </div>
      )}

      {/* 加载态 */}
      {isPageLoading && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {/* 引导态：toolkit 路径未配置 */}
      {isToolkitMissing && (
        <GuideCard
          message="尚未配置 embedded-mcp-toolkit 目录路径，项目级 MCP 配置依赖该路径，请先在设置中完成配置。"
          onNavigateSettings={onNavigateSettings}
        />
      )}

      {/* 就绪：项目卡片列表 */}
      {!isPageLoading && !isToolkitMissing && (
        <>
          {items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item, index) => (
                <ProjectCard
                  key={item.id}
                  item={item}
                  toolkitPath={toolkitPath}
                  refreshKey={refreshTick}
                  isDuplicate={isDuplicatePath(item)}
                  globalEnabled={globalMcpChecked}
                  autoFocus={index === items.length - 1 && item.path === ""}
                  onPathChange={updatePath}
                  onPickDirectory={handlePickDirectory}
                  onRemove={removeItem}
                />
              ))}
            </div>
          ) : (
            <div className="border border-dashed rounded-lg border-border px-6 py-8 text-center text-sm text-muted-foreground">
              暂无项目，点击右上角 + 添加
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** GuideCard 组件属性 */
interface GuideCardProps {
  /** 提示文案 */
  message: string;
  /** 跳转设置页回调 */
  onNavigateSettings: () => void;
}

/**
 * 引导态卡片
 *
 * toolkit 路径未配置或无效时展示提示文案与跳转按钮。
 * 与设备页 GuideCard 同构。
 *
 * @param props - 组件属性
 * @returns 渲染后的卡片元素
 */
function GuideCard({
  message,
  onNavigateSettings,
}: GuideCardProps): React.ReactElement {
  return (
    <div className="rounded-xl border bg-card p-8 text-center text-card-foreground">
      <Settings className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={onNavigateSettings} className="mt-4">
        去设置
      </Button>
    </div>
  );
}
