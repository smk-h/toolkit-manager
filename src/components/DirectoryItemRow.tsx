/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DirectoryItemRow.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 目录项卡片组件（名称+输入框+按钮组+校验提示）
 * ======================================================
 */

import { useEffect, useRef } from "react";

import { FolderOpen, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedCheck } from "@/hooks/useDebouncedCheck";
import { basename } from "@/lib/path";
import type { DirectoryItem } from "@/types/settings";

/** DirectoryItemRow 组件属性 */
export interface DirectoryItemRowProps {
  /** 目录项数据 */
  item: DirectoryItem;
  /** 名称变化回调（预置项不会触发，即时保存由父组件处理） */
  onNameChange: (id: string, name: string) => void;
  /** 路径变化回调（即时保存由父组件处理） */
  onPathChange: (id: string, path: string) => void;
  /** 删除回调 */
  onRemove: (id: string) => void;
  /** 打开目录选择器并填充路径的回调 */
  onPickDirectory: (id: string) => void;
  /** 是否自动聚焦（新增项传 true） */
  autoFocus?: boolean;
}

/**
 * 目录项卡片
 *
 * 卡片布局：第一行为名称输入框（预置项只读并加"预置"徽章），第二行为
 * 路径输入框 + 打开/删除按钮。预置项固定常驻、名称不可改、不显示删除按钮。
 * 自定义项名称为空时输入框以默认名（路径 basename 或"未命名"）作 placeholder。
 * 校验失败时输入框下方显示红字"目录不存在"。
 *
 * @param props - 组件属性
 * @returns 渲染后的卡片元素
 */
export function DirectoryItemRow({
  item,
  onNameChange,
  onPathChange,
  onRemove,
  onPickDirectory,
  autoFocus = false,
}: DirectoryItemRowProps): React.ReactElement {
  /**
   * 自定义项的默认名称（仅作 placeholder 提示，不写入数据）
   *
   * 有路径时由 basename 派生，否则为"未命名"。用户未输入名称时，
   * 输入框显示此占位，实际落盘的 name 仍为空——展示层再回退到默认名。
   */
  const defaultName = item.path ? basename(item.path) : "未命名";
  const validation = useDebouncedCheck(item.path);
  const inputRef = useRef<HTMLInputElement>(null);

  // 新增项自动聚焦
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const isInvalid = validation.status === "invalid";
  const errorId = `dir-error-${item.id}`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
      {/*
        右侧槽位定宽对齐：两行的右侧操作区共用同一固定宽度，
        保证名称输入框与路径输入框（均为 flex-1）实际宽度一致。
        宽度 = 两个 icon 按钮(各 32px) + 一个 gap(8px) = 72px。
      */}
      {/* 第一行：名称输入框 + 预置徽章 */}
      <div className="flex items-center gap-2">
        <Input
          value={item.name}
          onChange={(e) => onNameChange(item.id, e.target.value)}
          placeholder={defaultName}
          readOnly={item.isPreset}
          aria-label="目录名称"
          className="flex-1 font-medium"
        />
        {/* 预置徽章占用与下方按钮组等宽的右侧槽位 */}
        {item.isPreset ? (
          <span className="flex h-8 w-[72px] flex-shrink-0 items-center justify-start rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            预置
          </span>
        ) : (
          <span className="h-8 w-[72px] flex-shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* 第二行：路径输入框 + 按钮组 */}
      <div className="flex items-center gap-2">
        {/* 路径输入框 */}
        <Input
          ref={inputRef}
          value={item.path}
          onChange={(e) => onPathChange(item.id, e.target.value)}
          placeholder="请输入或选择目录路径"
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? errorId : undefined}
          className="flex-1"
        />

        <div className="flex h-8 w-[72px] flex-shrink-0 items-center gap-2">
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

          {/* 删除按钮（预置项不显示，槽位由占位 span 在第一行补齐） */}
          {!item.isPreset && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="删除目录"
              title="删除目录"
              onClick={() => onRemove(item.id)}
              className="hover:bg-orange-500 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 校验提示（仅 invalid 时显示） */}
      {isInvalid && (
        <p
          id={errorId}
          className="text-xs text-red-600 dark:text-red-400"
        >
          目录不存在
        </p>
      )}
    </div>
  );
}
