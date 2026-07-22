/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DeviceCreateDialog.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 新增设备对话框（两阶段：名称输入 → 配置 → 保存）
 * ======================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { readTextFile } from "@tauri-apps/plugin-fs";

import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";
import { createDeviceFromTemplate, parseDevice } from "@/lib/devices";
import {
  MASKED_VALUE,
  TEMPLATE_FILE_NAME,
  validateDeviceName,
} from "@/config/devices";
import type { Device } from "@/types/device";

/** DeviceCreateDialog 组件属性 */
export interface DeviceCreateDialogProps {
  /** 现有设备名列表（用于重名校验） */
  existingNames: readonly string[];
  /** 设备目录完整路径（末尾不带分隔符） */
  devicesDir: string;
  /** 是否打开 */
  open: boolean;
  /** 关闭/取消回调 */
  onClose: () => void;
  /** 创建成功回调（触发列表刷新 + toast） */
  onCreated: (deviceName: string) => void;
}

/** 对话框阶段 */
type Stage = "name" | "config";

/** 配置界面一个受控字段的配置（与 DeviceEditDialog 同构） */
interface FormField {
  /** 点分路径 Key，如 "ssh.port" */
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
  /** 字段列表 */
  fields: FormField[];
}

/** 模板数据（解析后的设备对象 + 原文，保存时做字段替换的基础） */
interface TemplateData {
  /** 模板解析为 Device（预填配置界面用） */
  device: Device;
  /** 模板原始文本（保存时做字段替换的基础） */
  rawText: string;
}

/** 是否为密码类敏感字段 */
function isPasswordField(path: string): boolean {
  return path === "ssh.password" || path === "serial.loginPassword";
}

/** 三区块字段组定义（与 DeviceEditDialog 一致，模板三通道均有值故全部展示） */
const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    title: "SSH",
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
    fields: [{ path: "adb.serialNo", label: "serialNo", type: "text" }],
  },
];

/**
 * 从模板 Device 展平为表单初始值
 *
 * 只提取已知字段，缺失字段用空字符串填充。
 * 密码字段用 {@link MASKED_VALUE} 按原长度占位。
 *
 * @param device - 模板解析出的设备对象
 * @returns 点分路径 → 初始值的映射
 */
function buildInitialValuesFromTemplate(
  device: Device,
): Record<string, string> {
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
 * 从模板设备中获取指定密码字段的原始值
 *
 * @param template - 模板设备快照
 * @param path - 点分路径
 * @returns 原始密码值或 undefined
 */
function getTemplatePassword(
  template: Device,
  path: string,
): string | undefined {
  if (path === "ssh.password") {
    return template.ssh?.password;
  }
  if (path === "serial.loginPassword") {
    return template.serial?.loginPassword;
  }
  return undefined;
}

/**
 * 新增设备对话框
 *
 * 两阶段流程：
 * - 阶段一「name」：输入设备名 + 实时校验（空/非法字符/重名）
 * - 阶段二「config」：基于模板 board-example.yaml 预填的配置界面，保存后落盘
 *
 * 模板在点击「下一步」时按需读取；取消/关闭时重置全部状态，不创建任何文件。
 *
 * @param props - 组件属性
 * @returns 渲染后的 Dialog 元素
 */
export function DeviceCreateDialog({
  existingNames,
  devicesDir,
  open,
  onClose,
  onCreated,
}: DeviceCreateDialogProps): React.ReactElement {
  const { show } = useToast();

  // 阶段与设备名
  const [stage, setStage] = useState<Stage>("name");
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  // 模板与配置表单
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const templateRef = useRef<Device | null>(null);

  // 异步状态
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);

  // 打开/关闭时重置全部状态（取消保护 F6：避免下次打开残留上次输入）
  useEffect(() => {
    if (open) {
      setStage("name");
      setName("");
      setTouched(false);
      setTemplate(null);
      setValues({});
      templateRef.current = null;
    }
  }, [open]);

  /**
   * 重置全部内部状态并关闭
   *
   * 取消/X/ESC/遮罩均走此路径，确保不残留输入。
   */
  const handleClose = useCallback((): void => {
    setStage("name");
    setName("");
    setTouched(false);
    setTemplate(null);
    setValues({});
    templateRef.current = null;
    onClose();
  }, [onClose]);

  /** 设备名输入变更 */
  const handleNameChange = useCallback((value: string): void => {
    setName(value);
    setTouched(true);
  }, []);

  /**
   * 点击「下一步」：按需读取模板并切到配置阶段
   *
   * 模板读取失败时 toast 提示并保持阶段一。
   */
  const handleNext = useCallback(async (): Promise<void> => {
    if (loadingTemplate) {
      return;
    }
    setLoadingTemplate(true);
    try {
      const templatePath = `${devicesDir}/${TEMPLATE_FILE_NAME}.yaml`;
      const rawText = await readTextFile(templatePath);
      const device = parseDevice(TEMPLATE_FILE_NAME, templatePath, rawText);
      if (!device) {
        // 模板存在但解析失败（格式错误）
        show("模板文件读取失败，请检查 board-example.yaml 是否存在", "error");
        return;
      }
      templateRef.current = device;
      setTemplate({ device, rawText });
      setValues(buildInitialValuesFromTemplate(device));
      setStage("config");
    } catch (error) {
      // 模板文件不存在或读取异常
      console.error("[DeviceCreateDialog] load template failed:", error);
      show("模板文件读取失败，请检查 board-example.yaml 是否存在", "error");
    } finally {
      setLoadingTemplate(false);
    }
  }, [devicesDir, loadingTemplate, show]);

  /** 回到设备名输入阶段（保留已输入名称与已修改配置） */
  const handleBack = useCallback((): void => {
    setStage("name");
  }, []);

  /** 更新单个配置字段值 */
  const handleChange = useCallback(
    (path: string, newValue: string): void => {
      setValues((prev) => ({ ...prev, [path]: newValue }));
    },
    [],
  );

  /** 密码框聚焦时清空占位符 */
  const handlePasswordFocus = useCallback(
    (path: string): void => {
      const orig = templateRef.current;
      if (!orig) {
        return;
      }
      const origPassword = getTemplatePassword(orig, path);
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
      const orig = templateRef.current;
      if (!orig) {
        return;
      }
      const origPassword = getTemplatePassword(orig, path);
      const currentValue = values[path] ?? "";
      if (currentValue === "" && origPassword) {
        setValues((prev) => ({
          ...prev,
          [path]: MASKED_VALUE.repeat(origPassword.length),
        }));
      }
    },
    [values],
  );

  /**
   * 点击「保存」：构建 fieldUpdates 并创建设备文件
   *
   * 仅纳入与模板原值不同的字段；密码字段仍为占位符则视为未改。
   */
  const handleSave = useCallback(async (): Promise<void> => {
    const orig = templateRef.current;
    if (!orig || saving) {
      return;
    }

    // 收集与模板原值不同的字段
    const updates: Record<string, string | number | undefined> = {};
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        const newValue = values[field.path] ?? "";
        const origValue = getOrigFieldValue(orig, field.path);

        // 密码字段：仍为占位符 → 视为未改，跳过
        if (isPasswordField(field.path)) {
          const origPassword = getTemplatePassword(orig, field.path);
          if (origPassword && newValue === MASKED_VALUE.repeat(origPassword.length)) {
            continue;
          }
          // 密码清空 → 不纳入（保持模板原值）
          if (newValue === "") {
            continue;
          }
          if (newValue === origValue) {
            continue;
          }
          updates[field.path] = newValue;
          continue;
        }

        // 空值 → 视为未配置，跳过（不写入空字符串覆盖模板默认值）
        if (newValue === "") {
          continue;
        }
        // 与模板原值相同 → 跳过
        if (newValue === origValue) {
          continue;
        }

        // 数值字段转 number
        if (field.path.endsWith(".port") || field.path.endsWith(".baudRate")) {
          const num = Number(newValue);
          updates[field.path] = Number.isNaN(num) ? newValue : num;
        } else {
          updates[field.path] = newValue;
        }
      }
    }

    setSaving(true);
    try {
      await createDeviceFromTemplate(devicesDir, name, updates);
      onCreated(name);
    } catch (error) {
      console.error("[DeviceCreateDialog] create failed:", error);
      show("创建失败，请稍后重试", "error");
    } finally {
      setSaving(false);
    }
  }, [values, saving, devicesDir, name, onCreated, show]);

  // 派生：实时校验结果（未 touched 不报空值错，避免一打开就标红）
  const validation = touched
    ? validateDeviceName(name, existingNames)
    : { valid: true as const };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={stage === "config" ? `配置新设备 · ${name}` : "新增设备"}
    >
      {/* 阶段一：设备名输入 */}
      {stage === "name" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              设备名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
              className={`w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 ${
                validation.valid
                  ? "border-input focus:border-ring focus:ring-ring"
                  : "border-destructive focus:border-destructive focus:ring-destructive"
              }`}
            />
            {!validation.valid && (
              <p className="mt-1 text-xs text-destructive">
                {validation.reason}
              </p>
            )}
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loadingTemplate}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!validation.valid || loadingTemplate}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loadingTemplate ? "加载中..." : "下一步"}
            </button>
          </div>
        </div>
      )}

      {/* 阶段二：配置界面 */}
      {stage === "config" && template && (
        <div className="space-y-4">
          {FIELD_GROUPS.map((group) => (
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
          ))}

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={saving}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              上一步
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
 * 从模板设备快照中获取指定字段的原始字符串值
 *
 * 用于保存时与新值比对，决定是否纳入 fieldUpdates。
 *
 * @param orig - 模板设备快照
 * @param path - 点分路径
 * @returns 原始值的字符串形式，或 undefined（字段不存在）
 */
function getOrigFieldValue(
  orig: Device,
  path: string,
): string | undefined {
  if (path === "ssh.host") {
    return orig.ssh?.host;
  }
  if (path === "ssh.port") {
    return orig.ssh?.port !== undefined ? String(orig.ssh.port) : undefined;
  }
  if (path === "ssh.username") {
    return orig.ssh?.username;
  }
  if (path === "ssh.password") {
    return orig.ssh?.password;
  }
  if (path === "ssh.keyProvider.mode") {
    return orig.ssh?.keyProvider?.mode;
  }
  if (path === "serial.port") {
    return orig.serial?.port;
  }
  if (path === "serial.baudRate") {
    return orig.serial?.baudRate !== undefined
      ? String(orig.serial?.baudRate)
      : undefined;
  }
  if (path === "serial.loginUsername") {
    return orig.serial?.loginUsername;
  }
  if (path === "serial.loginPassword") {
    return orig.serial?.loginPassword;
  }
  if (path === "serial.keyProvider.mode") {
    return orig.serial?.keyProvider?.mode;
  }
  if (path === "adb.serialNo") {
    return orig.adb?.serialNo;
  }
  return undefined;
}
