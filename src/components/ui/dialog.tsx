/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : dialog.tsx (ui)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 轻量 Modal 基础组件（遮罩 + 居中面板 + ESC/遮罩关闭）
 * ======================================================
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Dialog 组件属性 */
export interface DialogProps {
  /** 是否打开（false 时不渲染） */
  open: boolean;
  /** 关闭回调（ESC / 点击遮罩 / 关闭按钮触发） */
  onClose: () => void;
  /** 面板内容 */
  children: React.ReactNode;
  /** 标题（可选，显示在面板顶部） */
  title?: string;
  /** 附加 className（应用到面板） */
  className?: string;
}

/**
 * Modal 对话框
 *
 * 居中浮于内容上方的面板，含半透明遮罩层、无第三方弹窗依赖。
 * 交互：ESC 关闭、点击遮罩关闭、右上角 X 关闭。
 *
 * 通过 createPortal 渲染到 document.body，脱离组件树中可能存在的
 * 层叠上下文（如 framer-motion 的 opacity/will-change、overflow 容器），
 * 保证遮罩铺满视口、层级覆盖整页。
 *
 * @param props - 组件属性
 * @returns open 为 true 时返回 Portal，否则返回 null
 */
export function Dialog({
  open,
  onClose,
  children,
  title,
  className,
}: DialogProps): React.ReactElement | null {
  // ESC 键关闭
  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  // 打开时锁定 body 滚动，避免背景内容穿透滚动
  useEffect(() => {
    if (!open) {
      return;
    }
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  // 通过 Portal 渲染到 body，脱离组件树中可能的层叠上下文
  // （如 framer-motion 的 opacity/will-change、overflow 容器），
  // 确保 fixed 定位相对视口、z-index 能覆盖整页。
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* 半透明遮罩：阻挡下方页面内容透出，点击关闭 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border bg-card text-card-foreground shadow-lg",
          className,
        )}
      >
        {/* 标题栏 */}
        {title && (
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        {/* 关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {/* 内容区 */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
