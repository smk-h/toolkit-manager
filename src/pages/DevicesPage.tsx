/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DevicesPage.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备管理页（读取 yaml 设备配置 + 引导态 + 详情/复制）
 * ======================================================
 */

import { useState } from "react";

import { Settings } from "lucide-react";

import { DeviceCard } from "@/components/DeviceCard";
import { DeviceCreateDialog } from "@/components/DeviceCreateDialog";
import { DeviceDeleteDialog } from "@/components/DeviceDeleteDialog";
import { DeviceDetailDialog } from "@/components/DeviceDetailDialog";
import { DeviceEditDialog } from "@/components/DeviceEditDialog";
import { Button } from "@/components/ui/button";
import { DEVICES_SUBDIR, PRESET_DEVICE_DIR_NAME } from "@/config/devices";
import { useDevices } from "@/hooks/useDevices";
import { useDirectoryConfig } from "@/hooks/useDirectoryConfig";
import { useToast } from "@/hooks/useToast";
import { copyText } from "@/lib/clipboard";
import type { Device } from "@/types/device";

/** DevicesPage 组件属性 */
export interface DevicesPageProps {
  /** 跳转到设置页（引导态按钮触发） */
  onNavigateSettings: () => void;
  /** 新增设备对话框受控开关（由 Header 按钮经 App 控制） */
  createOpen: boolean;
  /** 新增设备对话框关闭回调 */
  onCreateClose: () => void;
}

/**
 * 设备管理页
 *
 * 按 useDevices 的 status 分流渲染：
 * - loading：加载提示
 * - no-path / dir-missing：引导态（提示 + 跳转设置按钮）
 * - error：错误提示
 * - ready：设备卡片列表（含详情对话框、复制、占位编辑/删除）
 *
 * @param props - 组件属性
 * @returns 渲染后的页面元素
 */
export function DevicesPage({
  onNavigateSettings,
  createOpen,
  onCreateClose,
}: DevicesPageProps): React.ReactElement {
  const { status, reload } = useDevices();
  const { show } = useToast();
  // 详情对话框当前查看的设备
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  // 编辑对话框当前编辑的设备
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  // 删除对话框当前待删的设备
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);

  // 新增设备所需上下文：设备目录路径与现有设备名集合
  // useDirectoryConfig 与 useDevices 内部一致，取预置项路径拼 devices 子目录
  const { items: dirItems, isLoading: dirLoading } = useDirectoryConfig();
  const presetItem = dirLoading
    ? undefined
    : dirItems.find((i) => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME);
  const devicesDir = presetItem?.path
    ? `${presetItem.path.replace(/[\\/]+$/, "")}/${DEVICES_SUBDIR}`
    : "";
  const existingNames =
    status.kind === "ready" ? status.devices.map((d) => d.name) : [];

  /**
   * 复制设备原始 yaml 全文到剪贴板
   *
   * @param device - 目标设备
   */
  const handleCopy = async (device: Device): Promise<void> => {
    const ok = await copyText(device.rawYaml);
    if (ok) {
      show("已复制 yaml 到剪贴板", "success");
    } else {
      show("复制失败", "error");
    }
  };

  /** 编辑 */
  const handleEdit = (device: Device): void => {
    setEditDevice(device);
  };

  /** 编辑保存成功 */
  const handleEditSaved = (): void => {
    reload();
    setEditDevice(null);
  };

  /** 删除 */
  const handleDelete = (device: Device): void => {
    setDeleteDevice(device);
  };

  /** 删除确认成功 */
  const handleDeleteDone = (): void => {
    reload();
    setDeleteDevice(null);
  };

  /** 新增设备创建成功 */
  const handleCreated = (deviceName: string): void => {
    reload();
    show(`设备「${deviceName}」已创建`, "success");
    onCreateClose();
  };

  return (
    <div className="space-y-6">
      {/* 标题区：仅 ready 态显示总数，其余态由各自提示区说明 */}
      {status.kind === "ready" && (
        <div>
          <h2 className="text-xl font-semibold">设备管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {status.devices.length} 台设备
          </p>
        </div>
      )}

      {/* 加载态 */}
      {status.kind === "loading" && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      )}

      {/* 引导态：未配置路径 */}
      {status.kind === "no-path" && (
        <GuideCard
          message="尚未配置 embedded-mcp-toolkit 目录路径，请先在设置中完成配置。"
          onNavigateSettings={onNavigateSettings}
        />
      )}

      {/* 引导态：路径已填但目录不存在 */}
      {status.kind === "dir-missing" && (
        <GuideCard
          message="配置的 embedded-mcp-toolkit 路径下未找到 .embedded/configs/devices 目录，请检查路径是否正确。"
          onNavigateSettings={onNavigateSettings}
        />
      )}

      {/* 错误态 */}
      {status.kind === "error" && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          设备配置读取失败，请稍后重试。
        </div>
      )}

      {/* 就绪：设备列表 */}
      {status.kind === "ready" && (
        <>
          {status.devices.length > 0 ? (
            <div className="space-y-3">
              {status.devices.map((device) => (
                <DeviceCard
                  key={device.name}
                  device={device}
                  onDetail={setDetailDevice}
                  onCopy={handleCopy}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="border border-dashed rounded-lg border-border px-6 py-8 text-center text-sm text-muted-foreground">
              目录下暂无设备配置文件
            </div>
          )}
        </>
      )}

      {/* 详情对话框 */}
      <DeviceDetailDialog
        device={detailDevice}
        onClose={() => setDetailDevice(null)}
      />

      {/* 编辑对话框 */}
      <DeviceEditDialog
        device={editDevice}
        onClose={() => setEditDevice(null)}
        onSaved={handleEditSaved}
      />

      {/* 删除确认对话框 */}
      <DeviceDeleteDialog
        device={deleteDevice}
        onClose={() => setDeleteDevice(null)}
        onDeleted={handleDeleteDone}
      />

      {/* 新增设备对话框 */}
      <DeviceCreateDialog
        existingNames={existingNames}
        devicesDir={devicesDir}
        open={createOpen}
        onClose={onCreateClose}
        onCreated={handleCreated}
      />
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
 * 未配置或路径无效时展示提示文案与跳转按钮。
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
