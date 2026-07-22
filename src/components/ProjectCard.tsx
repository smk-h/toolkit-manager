/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : ProjectCard.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 项目卡片组件（路径输入 + 打开 + 配置 + 删除 + 状态徽章 + 警告）
 * ======================================================
 */

import { useEffect, useRef, useState } from "react";

import { FolderOpen, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedCheck } from "@/hooks/useDebouncedCheck";
import { useToast } from "@/hooks/useToast";
import { applyProjectConfig, detectProjectStatus } from "@/lib/projects";
import type { ProjectConfigStatus, ProjectItem } from "@/types/projects";

/** 防抖时长（毫秒），与 useDebouncedCheck 默认值一致 */
const STATUS_DEBOUNCE_MS = 400;

/** ProjectCard 组件属性 */
export interface ProjectCardProps {
  /** 项目项数据 */
  item: ProjectItem;
  /** embedded-mcp-toolkit 根路径（由页面从 directory-config 预置项取） */
  toolkitPath: string;
  /** 路径是否与其它项目重复（由页面层跨项比对计算） */
  isDuplicate: boolean;
  /**
   * 全局 MCP 是否已启用（true 时配置按钮强制禁用，优先级高于项目自身状态）
   */
  globalEnabled: boolean;
  /** 路径变化回调（即时保存由父组件处理） */
  onPathChange: (id: string, path: string) => void;
  /** 打开目录选择器并填充路径的回调 */
  onPickDirectory: (id: string) => void;
  /**
   * 删除回调（仅清理应用内记录与 settings.json，不触碰项目目录文件）
   */
  onRemove: (id: string) => void;
  /** 自动聚焦（新增项传 true） */
  autoFocus?: boolean;
}

/**
 * 按配置状态渲染徽章
 *
 * ok 绿色、not-configured 橙色、config-error 红色；
 * idle/checking 不渲染徽章（checking 显示"检测中"小字）。
 *
 * @param status - 配置状态
 * @returns 徽章元素或 null
 */
function renderStatusBadge(status: ProjectConfigStatus): React.ReactNode {
  switch (status.kind) {
    case "idle":
      return null;
    case "checking":
      return (
        <span className="text-[11px] text-muted-foreground">检测中...</span>
      );
    case "ok":
      return (
        <span className="rounded bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
          OK
        </span>
      );
    case "not-configured":
      return (
        <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:text-orange-400">
          未配置
        </span>
      );
    case "config-error":
      return (
        <span className="rounded bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
          配置错误
        </span>
      );
  }
}

/**
 * 项目卡片
 *
 * 布局：第一行为路径输入框 + 右侧状态徽章槽位，
 * 第二行为「打开」「配置」「删除」按钮组，下方为警告提示区。
 *
 * - 状态检测：path 变化时防抖触发 detectProjectStatus
 * - 配置按钮：全局启用或项目 OK 时禁用，其余态可点，成功后刷新徽章
 * - 删除按钮：仅清理记录，不触碰项目目录文件
 * - 警告：重复路径 / 路径不存在（红字提示，不阻断操作）
 *
 * @param props - 组件属性
 * @returns 渲染后的卡片元素
 */
export function ProjectCard({
  item,
  toolkitPath,
  isDuplicate,
  globalEnabled,
  onPathChange,
  onPickDirectory,
  onRemove,
  autoFocus = false,
}: ProjectCardProps): React.ReactElement {
  const [status, setStatus] = useState<ProjectConfigStatus>({ kind: "idle" });
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  // 路径存在性检测（F8：路径不存在时警告，但不阻断操作）
  const pathCheck = useDebouncedCheck(item.path);

  // 新增项自动聚焦
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  // 防抖状态检测：path 或 toolkitPath 变化时延迟检测
  useEffect(() => {
    // 空路径：直接 idle，不触发 fs 调用
    if (!item.path.trim()) {
      setStatus({ kind: "idle" });
      return;
    }
    // 先切到 checking 提供即时反馈
    setStatus({ kind: "checking" });
    const timer = setTimeout(async () => {
      try {
        const result = await detectProjectStatus(item.path, toolkitPath);
        setStatus(result);
      } catch (error) {
        // 异常降级为 not-configured（spec N3）
        console.warn("[ProjectCard] detectProjectStatus failed:", error);
        setStatus({ kind: "not-configured" });
      }
    }, STATUS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [item.path, toolkitPath]);

  /**
   * 一键配置：写入/修正两文件，成功后刷新徽章
   */
  const handleConfig = async (): Promise<void> => {
    try {
      await applyProjectConfig(item.path, toolkitPath);
      show("项目配置已写入", "success");
      // 配置后立即重新检测，刷新徽章
      const result = await detectProjectStatus(item.path, toolkitPath);
      setStatus(result);
    } catch (error) {
      console.warn("[ProjectCard] applyProjectConfig failed:", error);
      show("项目配置失败", "error");
    }
  };

  // 配置按钮可用性：全局启用或项目 OK 时禁用（全局优先级更高）
  const isConfigured = status.kind === "ok";
  const configDisabled = globalEnabled || isConfigured;
  // 是否显示路径不存在警告（仅检测已完成且非 idle/checking 时有意义）
  // 此处用 status 推断：not-configured/config-error 可能因路径本身问题，
  // 但路径存在性由专门的检测更准确——这里用一个轻量 exists 判断
  // 为避免重复 fs 调用，路径不存在的警告交由页面层 useDebouncedCheck 统一管理（见 ProjectsPage）
  // 卡片层只负责"重复路径"警告（需跨项比对，页面层计算）
  const showDuplicateWarning = isDuplicate && item.path.trim() !== "";
  // 路径不存在警告：仅在校验完成且 invalid 时显示（允许保留，因用户可能想通过配置按钮创建目录）
  const showMissingWarning = pathCheck.status === "invalid";

  const errorId = `project-error-${item.id}`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
      {/*
        右侧槽位定宽对齐：两行的右侧操作区共用同一固定宽度。
        宽度 = 徽章槽位（约 64px），按钮组三个 icon（各 32px + 两个 gap 8px = 112px）。
      */}
      {/* 第一行：路径输入框 + 状态徽章 */}
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={item.path}
          onChange={(e) => onPathChange(item.id, e.target.value)}
          placeholder="请输入或选择项目目录路径"
          aria-label="项目路径"
          className="flex-1 font-medium"
        />
        {/* 状态徽章槽位（定宽，避免输入框宽度随徽章跳动） */}
        <span className="flex h-9 w-16 flex-shrink-0 items-center justify-end">
          {renderStatusBadge(status)}
        </span>
      </div>

      {/* 第二行：按钮组（打开 + 配置 + 删除） */}
      <div className="flex items-center gap-2">
        {/* 打开目录按钮 */}
        <Button
          variant="outline"
          size="icon"
          aria-label="打开目录"
          title="打开目录"
          onClick={() => onPickDirectory(item.id)}
          className="hover:border-orange-500 hover:bg-orange-500 hover:text-white"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>

        {/* 配置按钮：OK 态灰色不可点，其余态可点 + 橙色悬浮 */}
        <Button
          variant="outline"
          size="icon"
          aria-label="配置 MCP"
          title={
            globalEnabled
              ? "全局配置已启用，项目级配置已禁用"
              : isConfigured
                ? "已配置"
                : "配置 MCP"
          }
          disabled={configDisabled}
          onClick={handleConfig}
          className={
            configDisabled
              ? "opacity-50"
              : "hover:border-orange-500 hover:bg-orange-500 hover:text-white"
          }
        >
          <Settings2 className="h-4 w-4" />
        </Button>

        {/* 删除按钮：仅清理记录，不触碰项目目录文件 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="删除项目"
          title="删除项目（仅移除记录，不删除项目目录文件）"
          onClick={() => onRemove(item.id)}
          className="hover:bg-orange-500 hover:text-white"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 警告提示区：重复路径 / 路径不存在（均不阻断操作） */}
      {showDuplicateWarning && (
        <p className="text-xs text-red-600 dark:text-red-400">
          路径与已有项目重复
        </p>
      )}
      {showMissingWarning && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          路径不存在（可点击配置按钮创建目录）
        </p>
      )}
    </div>
  );
}
