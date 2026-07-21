/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : DevicesPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设备管理页（卡片列表）
 * ======================================================
 */

import { useState } from "react";

import { DeviceCard } from "@/components/DeviceCard";
import { MOCK_DEVICES } from "@/config/devices";

/**
 * 设备管理页
 *
 * 渲染标题区与设备卡片列表，持有单选选中状态。
 * 本章节设备数据来自 MOCK_DEVICES（完全静态），
 * 后续章节替换为 Tauri 系统接口返回值时只需改数据源。
 *
 * @returns 渲染后的页面元素
 */
export function DevicesPage(): React.ReactElement {
  // 选中状态：仅 React state，不持久化；初始为 null（无选中）
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div>
        <h2 className="text-xl font-semibold">设备管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {MOCK_DEVICES.length} 台设备
        </p>
      </div>

      {/* 卡片列表 */}
      <div className="space-y-3">
        {MOCK_DEVICES.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            isSelected={device.id === selectedId}
            onSelect={(d): void => setSelectedId(d.id)}
          />
        ))}
      </div>

      {/* 空状态兜底（防御性，本章节 MOCK_DEVICES 非空不会触发） */}
      {MOCK_DEVICES.length === 0 && (
        <div className="px-6 py-8 text-center border border-dashed rounded-lg border-border text-muted-foreground">
          暂无设备
        </div>
      )}
    </div>
  );
}
