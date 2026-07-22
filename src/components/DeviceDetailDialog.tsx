/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceDetailDialog.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备详情对话框（分通道展示完整配置）
 * ======================================================
 */

import { Dialog } from "@/components/ui/dialog";
import { MASKED_VALUE } from "@/config/devices";
import { isAdbEnabled, isSerialEnabled, isSshEnabled } from "@/lib/devices";
import type { Device } from "@/types/device";

/** DeviceDetailDialog 组件属性 */
export interface DeviceDetailDialogProps {
  /** 当前查看的设备（null 时关闭） */
  device: Device | null;
  /** 关闭回调 */
  onClose: () => void;
}

/** 详情中展示的字段行配置 */
interface FieldRow {
  /** 字段名 */
  label: string;
  /** 字段值（undefined 表示该字段未配置） */
  value: string | number | undefined;
}

/**
 * 对敏感字段值进行脱敏处理
 *
 * 非空字符串按原长度用 {@link MASKED_VALUE} 重复填充以保留长度信息，
 * 否则返回 undefined 以在渲染层走默认的 "-" 逻辑。
 *
 * @param value - 原始值
 * @returns 脱敏后的值或 undefined
 */
function maskSensitive(
  value: string | undefined,
): string | undefined {
  return value ? MASKED_VALUE.repeat(value.length) : undefined;
}

/**
 * 单个通道区块的展示
 *
 * @param title - 区块标题
 * @param enabled - 该通道是否启用
 * @param fields - 字段行列表
 * @returns 渲染后的区块元素
 */
function renderChannelBlock(
  title: string,
  enabled: boolean,
  fields: readonly FieldRow[],
): React.ReactElement {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {enabled ? (
        <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
          {fields.map((field) => (
            <div key={field.label} className="contents">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="break-all font-mono text-foreground">
                {field.value === undefined || field.value === ""
                  ? "-"
                  : String(field.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          未配置
        </p>
      )}
    </div>
  );
}

/**
 * 设备详情对话框
 *
 * 分 SSH / Serial / ADB 三区块展示设备完整配置。
 * password 等敏感字段默认用 {MASKED_VALUE} 脱敏展示。
 *
 * @param props - 组件属性
 * @returns 渲染后的 Dialog 元素
 */
export function DeviceDetailDialog({
  device,
  onClose,
}: DeviceDetailDialogProps): React.ReactElement {
  const open = device !== null;

  return (
    <Dialog open={open} onClose={onClose} title={device?.name ?? "设备详情"}>
      {device && (
        <div className="space-y-4">
          {/* SSH 区块 */}
          {renderChannelBlock("SSH", isSshEnabled(device.ssh), [
            { label: "host", value: device.ssh?.host },
            { label: "port", value: device.ssh?.port },
            { label: "username", value: device.ssh?.username },
            { label: "password", value: maskSensitive(device.ssh?.password) },
            { label: "keyProvider.mode", value: device.ssh?.keyProvider?.mode },
          ])}

          {/* Serial 区块 */}
          {renderChannelBlock("Serial", isSerialEnabled(device.serial), [
            { label: "port", value: device.serial?.port },
            { label: "baudRate", value: device.serial?.baudRate },
            { label: "loginUsername", value: device.serial?.loginUsername },
            { label: "loginPassword", value: maskSensitive(device.serial?.loginPassword) },
            {
              label: "keyProvider.mode",
              value: device.serial?.keyProvider?.mode,
            },
          ])}

          {/* ADB 区块 */}
          {renderChannelBlock("ADB", isAdbEnabled(device.adb), [
            { label: "serialNo", value: device.adb?.serialNo },
          ])}
        </div>
      )}
    </Dialog>
  );
}
