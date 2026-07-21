/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DirectoryItemRow.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 目录项单行组件（名称+输入框+按钮组+校验提示）
 * ======================================================
 */

import { useEffect, useRef } from "react";

import { FolderOpen, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebouncedCheck } from "@/hooks/useDebouncedCheck";
import type { DirectoryItem } from "@/types/settings";

/** DirectoryItemRow 组件属性 */
export interface DirectoryItemRowProps {
  /** 目录项数据 */
  item: DirectoryItem;
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
 * 提取路径末尾段作为名称
 *
 * 按 / 和 \ 分割取最后非空段，兼容 Windows 与 Unix 路径。
 * 空路径或仅分隔符返回空字符串（由调用方转为"未命名"）。
 *
 * @param path - 完整路径
 * @returns 末尾段名称
 *
 * @example
 * basename("D:/foo/bar")  // "bar"
 * basename("C:\\Users")   // "Users"
 * basename("")            // ""
 */
function basename(path: string): string {
  const segments = path.split(/[\\/]/);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].trim();
    if (seg !== "") {
      return seg;
    }
  }
  return "";
}

/**
 * 目录项单行
 *
 * 横向布局：名称 + 路径输入框 + 打开按钮 + 删除按钮。
 * 校验失败时输入框下方显示红字"目录不存在"。
 * 名称由路径派生（basename），路径为空时显示"未命名"。
 *
 * @param props - 组件属性
 * @returns 渲染后的行元素
 */
export function DirectoryItemRow({
  item,
  onPathChange,
  onRemove,
  onPickDirectory,
  autoFocus = false,
}: DirectoryItemRowProps): React.ReactElement {
  const name = item.path ? basename(item.path) : "未命名";
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
    <div className="flex flex-col gap-1.5">
      {/* 主体行：名称 + 输入框 + 按钮组 */}
      <div className="flex items-center gap-2">
        {/* 名称（派生，只读展示，固定宽度避免长名称挤压输入框） */}
        <span
          className="w-24 flex-shrink-0 truncate text-sm text-muted-foreground"
          title={name}
        >
          {name}
        </span>

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

        {/* 打开目录按钮 */}
        <Button
          variant="outline"
          size="icon"
          aria-label="打开目录"
          title="打开目录"
          onClick={() => onPickDirectory(item.id)}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>

        {/* 删除按钮 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="删除目录"
          title="删除目录"
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 校验提示（仅 invalid 时显示） */}
      {isInvalid && (
        <p
          id={errorId}
          className="pl-[7.5rem] text-xs text-red-600 dark:text-red-400"
        >
          目录不存在
        </p>
      )}
    </div>
  );
}
