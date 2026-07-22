/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceDeleteDialog.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备删除确认对话框
 * ======================================================
 */

import { useCallback, useState } from "react";

import { trashDeviceFile } from "@/lib/devices";
import type { Device } from "@/types/device";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";

/** DeviceDeleteDialog 组件属性 */
export interface DeviceDeleteDialogProps {
  /** 待删除的设备（null 时关闭） */
  device: Device | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 删除成功回调 */
  onDeleted: () => void;
}

/**
 * 设备删除确认对话框
 *
 * 展示设备名称与确认提示，确认后通过 OS 回收站删除 YAML 文件。
 *
 * @param props - 组件属性
 * @returns 渲染后的 Dialog 元素
 */
export function DeviceDeleteDialog({
  device,
  onClose,
  onDeleted,
}: DeviceDeleteDialogProps): React.ReactElement | null {
  const { show } = useToast();
  const [deleting, setDeleting] = useState(false);
  const open = device !== null;

  /** 确认删除 */
  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!device || deleting) {
      return;
    }

    setDeleting(true);
    try {
      await trashDeviceFile(device.filePath);
      show("设备已移入回收站", "success");
      onDeleted();
    } catch (error) {
      console.error("[DeviceDeleteDialog] delete failed:", error);
      show("删除失败，请稍后重试", "error");
    } finally {
      setDeleting(false);
    }
  }, [device, deleting, onDeleted, show]);

  return (
    <Dialog open={open} onClose={onClose} title="删除设备">
      {device && (
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            确定要将「
            <span className="font-semibold">{device.name}</span>
            」移入回收站吗？
          </p>
          <p className="text-xs text-muted-foreground">
            此操作可在系统回收站中还原。
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? "删除中..." : "确定删除"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
