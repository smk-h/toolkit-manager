/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceEditDialog.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备编辑对话框（分通道展示可编辑表单）
 * ======================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { MASKED_VALUE } from "@/config/devices";
import { updateDeviceYaml } from "@/lib/devices";
import type { Device } from "@/types/device";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";

/** DeviceEditDialog 组件属性 */
export interface DeviceEditDialogProps {
  /** 当前编辑的设备（null 时关闭） */
  device: Device | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存成功回调 */
  onSaved: () => void;
}

/** 表单中一个受控字段的配置 */
interface FormField {
  /** 点分路径 Key，如 "ssh.password" */
  path: string;
  /** 显示标签 */
  label: string;
  /** 输入类型 */
  type: "text" | "number" | "password";
}

/** 通道区块的字段列表 */
interface FieldGroup {
  /** 区块标题 */
  title: string;
  /** 该通道是否启用（决定是否渲染） */
  enabled: boolean;
  /** 字段列表 */
  fields: FormField[];
}

/** 是否为密码类敏感字段 */
function isPasswordField(path: string): boolean {
  return path === "ssh.password" || path === "serial.loginPassword";
}

/**
 * 从设备对象展平为表单初始值
 *
 * 只提取已知字段，缺失字段用空字符串填充。
 * 密码字段用 {@link MASKED_VALUE} 按原长度占位。
 */
function buildInitialValues(device: Device): Record<string, string> {
  const values: Record<string, string> = {};

  // SSH
  if (device.ssh) {
    values["ssh.host"] = device.ssh.host ?? "";
    values["ssh.port"] = device.ssh.port !== undefined ? String(device.ssh.port) : "";
    values["ssh.username"] = device.ssh.username ?? "";
    values["ssh.password"] = device.ssh.password
      ? MASKED_VALUE.repeat(device.ssh.password.length)
      : "";
    values["ssh.keyProvider.mode"] = device.ssh.keyProvider?.mode ?? "";
  }

  // Serial
  if (device.serial) {
    values["serial.port"] = device.serial.port ?? "";
    values["serial.baudRate"] =
      device.serial.baudRate !== undefined ? String(device.serial.baudRate) : "";
    values["serial.loginUsername"] = device.serial.loginUsername ?? "";
    values["serial.loginPassword"] = device.serial.loginPassword
      ? MASKED_VALUE.repeat(device.serial.loginPassword.length)
      : "";
    values["serial.keyProvider.mode"] = device.serial.keyProvider?.mode ?? "";
  }

  // ADB
  if (device.adb) {
    values["adb.serialNo"] = device.adb.serialNo ?? "";
  }

  return values;
}

/**
 * 检测密码字段当前值是否仍为原始的脱敏占位符
 *
 * @param value - 当前输入值
 * @param origValue - 原始值（真实密码或 undefined）
 * @returns 是占位符（未修改）返回 true
 */
function isUnchangedPassword(
  value: string,
  origValue: string | undefined,
): boolean {
  if (!origValue) {
    return value === "";
  }
  return value === MASKED_VALUE.repeat(origValue.length);
}

/**
 * 设备编辑对话框
 *
 * 分 SSH / Serial / ADB 三区块展示可编辑表单，支持字段修改与增量保存。
 * 密码字段默认以 · 按长度占位，聚焦时清空，留空则恢复占位。
 *
 * @param props - 组件属性
 * @returns 渲染后的 Dialog 元素
 */
export function DeviceEditDialog({
  device,
  onClose,
  onSaved,
}: DeviceEditDialogProps): React.ReactElement | null {
  const { show } = useToast();
  const [saving, setSaving] = useState(false);

  // 表单值与脏字段跟踪
  const [values, setValues] = useState<Record<string, string>>({});
  const dirtyRef = useRef<Set<string>>(new Set());
  // 记录打开时的原始设备快照（用于密码比对）
  const origRef = useRef<Device | null>(null);

  // 设备切换时重新初始化表单
  useEffect(() => {
    if (device) {
      setValues(buildInitialValues(device));
      dirtyRef.current = new Set();
      origRef.current = device;
    }
  }, [device]);

  /** 更新单个字段值 */
  const handleChange = useCallback(
    (path: string, newValue: string): void => {
      setValues((prev) => ({ ...prev, [path]: newValue }));
      dirtyRef.current.add(path);
    },
    [],
  );

  /** 密码框聚焦时清空占位符 */
  const handlePasswordFocus = useCallback(
    (path: string): void => {
      const orig = origRef.current;
      if (!orig) {
        return;
      }
      const origPassword = getOrigPassword(orig, path);
      const currentValue = values[path] ?? "";
      // 只有当前值等于占位符时才清空
      if (origPassword && currentValue === MASKED_VALUE.repeat(origPassword.length)) {
        setValues((prev) => ({ ...prev, [path]: "" }));
      }
    },
    [values],
  );

  /** 密码框失焦时若为空则恢复占位符 */
  const handlePasswordBlur = useCallback(
    (path: string): void => {
      const orig = origRef.current;
      if (!orig) {
        return;
      }
      const origPassword = getOrigPassword(orig, path);
      const currentValue = values[path] ?? "";
      if (currentValue === "") {
        if (origPassword) {
          setValues((prev) => ({
            ...prev,
            [path]: MASKED_VALUE.repeat(origPassword.length),
          }));
          // 恢复占位符后从 dirty 移除（表示未修改）
          dirtyRef.current.delete(path);
        }
      }
    },
    [values],
  );

  /** 保存 */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!device || saving) {
      return;
    }

    const updates: Record<string, string | number | undefined> = {};
    const orig = origRef.current;
    if (!orig) {
      return;
    }

    for (const path of dirtyRef.current) {
      const newValue = values[path] ?? "";

      // 密码字段：若仍为占位符，跳过
      if (isPasswordField(path)) {
        const origPassword = getOrigPassword(orig, path);
        if (isUnchangedPassword(newValue, origPassword)) {
          continue;
        }
      }

      // 空字符串视为 undefined（删除字段）
      if (newValue === "") {
        updates[path] = undefined;
        continue;
      }

      // 数值字段转 number
      if (path.endsWith(".port") || path.endsWith(".baudRate")) {
        const num = Number(newValue);
        updates[path] = Number.isNaN(num) ? newValue : num;
      } else {
        updates[path] = newValue;
      }
    }

    // 无变更 → 幂等关闭
    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await updateDeviceYaml(device.filePath, updates);
      show("设备配置已保存", "success");
      onSaved();
    } catch (error) {
      console.error("[DeviceEditDialog] save failed:", error);
      show("保存失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }, [device, saving, values, onClose, onSaved, show]);

  const open = device !== null;

  // 构造三区块字段组
  const groups: FieldGroup[] = [
    {
      title: "SSH",
      enabled: !!(device?.ssh && device.ssh.host !== "none"),
      fields: [
        { path: "ssh.host", label: "host", type: "text" },
        { path: "ssh.port", label: "port", type: "number" },
        { path: "ssh.username", label: "username", type: "text" },
        { path: "ssh.password", label: "password", type: "password" },
        { path: "ssh.keyProvider.mode", label: "keyProvider.mode", type: "text" },
      ],
    },
    {
      title: "Serial",
      enabled: !!(device?.serial && device.serial.port !== "none"),
      fields: [
        { path: "serial.port", label: "port", type: "text" },
        { path: "serial.baudRate", label: "baudRate", type: "number" },
        { path: "serial.loginUsername", label: "loginUsername", type: "text" },
        { path: "serial.loginPassword", label: "loginPassword", type: "password" },
        { path: "serial.keyProvider.mode", label: "keyProvider.mode", type: "text" },
      ],
    },
    {
      title: "ADB",
      enabled: !!(device?.adb && device.adb.serialNo !== "sn_none" && device.adb.serialNo),
      fields: [{ path: "adb.serialNo", label: "serialNo", type: "text" }],
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} title={`编辑 ${device?.name ?? ""}`}>
      {device && (
        <div className="space-y-4">
          {groups.map((group) =>
            group.enabled ? (
              <div key={group.title} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {group.title}
                </h4>
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  {group.fields.map((field) => {
                    const isPwd = field.type === "password";
                    return (
                      <div key={field.path}>
                        <label className="mb-1 block text-xs text-muted-foreground">
                          {field.label}
                        </label>
                        <input
                          type={field.type}
                          value={values[field.path] ?? ""}
                          onChange={(e) => handleChange(field.path, e.target.value)}
                          onFocus={() => isPwd && handlePasswordFocus(field.path)}
                          onBlur={() => isPwd && handlePasswordBlur(field.path)}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/**
 * 从设备快照中获取指定密码字段的原始值
 *
 * @param orig - 设备快照
 * @param path - 点分路径
 * @returns 原始密码值或 undefined
 */
function getOrigPassword(
  orig: Device,
  path: string,
): string | undefined {
  if (path === "ssh.password") {
    return orig.ssh?.password;
  }
  if (path === "serial.loginPassword") {
    return orig.serial?.loginPassword;
  }
  return undefined;
}
