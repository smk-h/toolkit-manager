/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : GlobalMcpConfirmDialog.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 全局 MCP 配置开关确认对话框（开启/关闭复用）
 * ======================================================
 */

import { Dialog } from "@/components/ui/dialog";

/** 操作类型：决定对话框文案与按钮风格 */
type GlobalMcpAction = "enable" | "disable";

/** GlobalMcpConfirmDialog 组件属性 */
export interface GlobalMcpConfirmDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 操作类型（决定文案） */
  action: GlobalMcpAction;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消/关闭回调 */
  onClose: () => void;
}

/** 文案映射：按 action 区分标题、正文、按钮文案 */
const ACTION_COPY: Record<
  GlobalMcpAction,
  { title: string; message: string; confirm: string }
> = {
  enable: {
    title: "启用全局 MCP 配置",
    message:
      "启用全局 MCP 配置后，embedded-board 将对所有项目生效，项目级配置按钮将被禁用。是否继续？",
    confirm: "启用",
  },
  disable: {
    title: "关闭全局 MCP 配置",
    message:
      "关闭全局 MCP 配置后，将从 ~/.claude.json 移除 embedded-board，项目级配置按钮恢复可用。是否继续？",
    confirm: "关闭",
  },
};

/**
 * 全局 MCP 配置确认对话框
 *
 * 开启/关闭两种场景复用同一组件，按 action 字段区分文案与按钮风格。
 * enable 用默认蓝色确认按钮，disable 用 destructive 红色（语义区分）。
 *
 * @param props - 组件属性
 * @returns 渲染后的 Dialog 元素
 */
export function GlobalMcpConfirmDialog({
  open,
  action,
  onConfirm,
  onClose,
}: GlobalMcpConfirmDialogProps): React.ReactElement {
  const copy = ACTION_COPY[action];
  return (
    <Dialog open={open} onClose={onClose} title={copy.title}>
      <div className="space-y-4">
        <p className="text-sm text-foreground">{copy.message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              action === "disable"
                ? "rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90"
                : "rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            }
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
