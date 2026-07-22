/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : toast.tsx (ui)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 轻量全局提示渲染器（右下角堆叠，framer-motion 淡入淡出）
 * ======================================================
 */

import { AnimatePresence, motion } from "framer-motion";

import { useToast, type ToastItem } from "@/hooks/useToast";
import { cn } from "@/lib/utils";

/** toast 类型到样式 class 的映射 */
const TOAST_STYLE: Record<ToastItem["type"], string> = {
  success: "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
  error: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  info: "border-border bg-muted text-foreground",
};

/**
 * 全局 toast 容器
 *
 * 消费 useToast 全局队列，固定在右下角堆叠展示，逐条淡入淡出。
 * 应在应用根挂载一次，所有页面共享同一实例。
 *
 * @returns 渲染后的 toast 容器
 */
export function ToastContainer(): React.ReactElement {
  const { toasts, dismiss } = useToast();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismiss(toast.id)}
            className={cn(
              "pointer-events-auto cursor-pointer rounded-lg border px-4 py-2 text-sm shadow-md",
              TOAST_STYLE[toast.type],
            )}
            role="status"
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
