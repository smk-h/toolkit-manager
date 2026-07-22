/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : GlobalMcpSwitch.tsx
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 全局 MCP 配置开关组件（Header 受控开关）
 * ======================================================
 */

import { Switch } from "@/components/ui/switch";

/** GlobalMcpSwitch 组件属性 */
export interface GlobalMcpSwitchProps {
  /** 当前是否启用（受控，由 App 层持有） */
  checked: boolean;
  /**
   * 开关切换回调
   *
   * 父组件据此弹确认框并执行文件操作。由于 Radix Switch 受控，
   * checked 不在此处立即改变——确认流程完成后由父组件更新，
   * 取消时视觉自然回弹。
   *
   * @param checked - 用户拨动的目标状态
   */
  onCheckedChange: (checked: boolean) => void;
}

/**
 * 全局 MCP 配置开关
 *
 * 纯受控组件，渲染 label + Switch。不持有状态、不操作文件，
 * 所有副作用由父组件（App）编排。
 *
 * @param props - 组件属性
 * @returns 渲染后的开关元素
 */
export function GlobalMcpSwitch({
  checked,
  onCheckedChange,
}: GlobalMcpSwitchProps): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">全局 MCP</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="全局 MCP 配置开关"
      />
    </div>
  );
}
