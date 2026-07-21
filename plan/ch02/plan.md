<!-- more -->

# 设备卡片提取与展示 Plan

## 一、架构概览

本章在不引入新依赖的前提下，将 cc-switch 的 ProviderCard 提炼为 toolkit-manager 的设备卡片，并落地到设备页。整体分为三层：

```
┌─────────────────────────────────────────────────────┐
│  Pages 层（业务页面）                                 │
│  DevicesPage.tsx  ← 从占位页改为卡片列表页            │
│      │                                               │
│      ├─ 读取 MOCK_DEVICES 固定数据                    │
│      ├─ 持有 selectedId 选中状态                      │
│      └─ 渲染 DeviceCard 列表                         │
│                                                      │
│  Components 层（业务组件 + UI 基础组件）              │
│  DeviceCard.tsx       ← 卡片主体（移植自 ProviderCard）│
│  DeviceStatusBadge.tsx← 状态徽章（移植自 HealthBadge）│
│  ui/button.tsx        ← shadcn Button（新增）         │
│  ui/card.tsx          ← shadcn Card（新增，备用）     │
│                                                      │
│  Config / Types / Data 层                            │
│  types/device.ts      ← Device / DeviceStatus 类型   │
│  config/devices.ts    ← MOCK_DEVICES 固定数据        │
└─────────────────────────────────────────────────────┘
```

### 1.1 各组件职责

| 组件 | 职责 | 来源 |
|------|------|------|
| `DevicesPage` | 设备页主体，管理选中状态、渲染标题区与卡片列表 | 改造现有占位页 |
| `DeviceCard` | 单张卡片，展示设备信息 + 选中/悬停态 + 操作按钮 | 提炼自 cc-switch `ProviderCard` |
| `DeviceStatusBadge` | online/degraded/offline 三态 pill | 提炼自 cc-switch `ProviderHealthBadge` |
| `Button`（ui） | shadcn 基础按钮，CVA 驱动 variants | 新增，shadcn 官方实现 |
| `Card`（ui） | shadcn 基础卡片容器 | 新增，备用（DeviceCard 不强制使用） |

### 1.2 关键设计取舍

- **DeviceCard 不复用 ui/card.tsx**：cc-switch 的 ProviderCard 是高度定制样式（渐变层、状态边框、悬停 scale），塞进 shadcn Card 的 `CardHeader/CardContent` 语义结构反而别扭。因此 `ui/card.tsx` 作为基础库成员存在，供后续章节使用，但 `DeviceCard` 直接用原生 `<div>` + Tailwind。这与 spec F6 的约束一致。
- **状态徽章独立成组件**：复用度高（卡片标题、未来列表表头、详情页都可能用），且 cc-switch 本身也把 `ProviderHealthBadge` 拆成了独立组件。
- **数据与类型分层**：`types/device.ts` 只放类型，`config/devices.ts` 只放固定数据，便于后续章节替换为 Tauri 接口返回值。

## 二、核心数据结构

### 2.1 DeviceStatus（设备状态枚举）

```ts
/** 设备在线状态 */
export type DeviceStatus = "online" | "degraded" | "offline";
```

三态字面量联合类型，对应徽章三色。不用 enum 而用字面量联合，便于 JSON 序列化与 i18n key 拼接。

### 2.2 DeviceType（设备类型枚举）

```ts
/** 设备类型，决定卡片左侧图标 */
export type DeviceType = "laptop" | "desktop" | "server" | "mobile";
```

四态字面量联合，每个值映射到一个 lucide-react 图标组件（见 2.4 图标映射）。

### 2.3 Device（设备数据模型）

```ts
/** 设备数据模型 */
export interface Device {
  /** 唯一标识 */
  id: string;
  /** 设备名称（主标题） */
  name: string;
  /** 设备类型，决定图标 */
  type: DeviceType;
  /** 在线状态，决定徽章颜色 */
  status: DeviceStatus;
  /** IP 地址（次级信息行） */
  ip: string;
  /** MAC 地址（次级信息行） */
  mac: string;
  /** 操作系统（次级信息行） */
  os: string;
  /** 配置摘要（如 CPU / 内存一句话，次级信息下方） */
  configSummary: string;
}
```

字段对齐未来 Tauri 系统接口的返回结构，但本章节完全静态。所有字段必填（固定数据无需可选标记）。

### 2.4 设备类型 → 图标映射

```ts
import { Laptop, Monitor, Server, Smartphone, type LucideIcon } from "lucide-react";

/** 设备类型到图标的映射 */
export const DEVICE_TYPE_ICON: Record<DeviceType, LucideIcon> = {
  laptop: Laptop,
  desktop: Monitor,
  server: Server,
  mobile: Smartphone,
};
```

集中映射，避免散落在组件内的 switch。后续新增类型只需改这一处。

### 2.5 状态 → 徽章样式映射

```ts
/** 设备状态到徽章视觉样式的映射 */
export interface DeviceStatusStyle {
  /** 中文文案（本章节硬编码，后续替换为 i18n key） */
  label: string;
  /** 状态圆点背景色 class */
  dotClass: string;
  /** 徽章背景色 class */
  bgClass: string;
  /** 文字色 class */
  textClass: string;
}

export const DEVICE_STATUS_STYLE: Record<DeviceStatus, DeviceStatusStyle> = {
  online:   { label: "在线", dotClass: "bg-green-500",  bgClass: "bg-green-500/10",  textClass: "text-green-600 dark:text-green-400" },
  degraded: { label: "降级", dotClass: "bg-yellow-500", bgClass: "bg-yellow-500/10", textClass: "text-yellow-600 dark:text-yellow-400" },
  offline:  { label: "离线", dotClass: "bg-red-500",    bgClass: "bg-red-500/10",    textClass: "text-red-600 dark:text-red-400" },
};
```

与 cc-switch `ProviderHealthBadge` 的三色方案完全一致，配置化便于扩展。

## 三、模块设计

### 3.1 类型定义模块

**文件：** `src/types/device.ts`
**职责：** 导出 `DeviceStatus`、`DeviceType`、`Device` 三个类型，无运行时代码。
**依赖：** 无。

### 3.2 设备配置模块

**文件：** `src/config/devices.ts`
**职责：** 导出 `DEVICE_TYPE_ICON` 图标映射、`DEVICE_STATUS_STYLE` 样式映射、`MOCK_DEVICES` 固定设备数据（3-5 台，覆盖三种状态与多种类型）。
**对外接口：**
- `DEVICE_TYPE_ICON: Record<DeviceType, LucideIcon>`
- `DEVICE_STATUS_STYLE: Record<DeviceStatus, DeviceStatusStyle>`
- `MOCK_DEVICES: readonly Device[]`

**依赖：** `lucide-react`、`@/types/device`。

**MOCK_DEVICES 示例（5 台，覆盖 laptop/desktop/server/mobile 四种类型与三种状态）：**

| id | name | type | status | ip | mac | os | configSummary |
|----|------|------|--------|----|----|----|---------------|
| dev-001 | MacBook Pro | laptop | online | 192.168.1.10 | AA:BB:CC:00:00:01 | macOS 14.5 | M3 Pro · 18GB |
| dev-002 | Windows 工作站 | desktop | online | 192.168.1.11 | AA:BB:CC:00:00:02 | Windows 11 | i7-13700K · 32GB |
| dev-003 | Ubuntu 构建服务器 | server | degraded | 192.168.1.20 | AA:BB:CC:00:00:03 | Ubuntu 22.04 | Ryzen 9 · 64GB |
| dev-004 | 测试服务器 | server | offline | 192.168.1.21 | AA:BB:CC:00:00:04 | CentOS 7 | Xeon E5 · 32GB |
| dev-005 | iPhone 15 | mobile | offline | 192.168.1.30 | AA:BB:CC:00:00:05 | iOS 17.5 | A16 · 6GB |

### 3.3 状态徽章组件

**文件：** `src/components/DeviceStatusBadge.tsx`
**职责：** 根据 `status` 渲染对应配色的 pill 徽章（圆点 + 文案）。
**对外接口：**

```ts
export interface DeviceStatusBadgeProps {
  /** 设备状态 */
  status: DeviceStatus;
  /** 附加 className（可选） */
  className?: string;
}
export function DeviceStatusBadge(props: DeviceStatusBadgeProps): React.ReactElement;
```

**渲染结构：**

```tsx
<span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", style.bgClass, style.textClass, className)}>
  <span aria-hidden="true" className={cn("w-2 h-2 rounded-full", style.dotClass)} />
  <span>{style.label}</span>
</span>
```

**依赖：** `@/lib/utils`（`cn`）、`@/config/devices`（`DEVICE_STATUS_STYLE`）、`@/types/device`。

### 3.4 设备卡片组件

**文件：** `src/components/DeviceCard.tsx`
**职责：** 渲染单张设备卡片，承载选中态、悬停态、操作按钮区。
**对外接口：**

```ts
export interface DeviceCardProps {
  /** 设备数据 */
  device: Device;
  /** 是否选中 */
  isSelected: boolean;
  /** 点击卡片（非按钮区域）选中回调 */
  onSelect: (device: Device) => void;
}
export function DeviceCard(props: DeviceCardProps): React.ReactElement;
```

**内部结构（自左向右、自上而下）：**

```tsx
<div
  onClick={handleCardClick}           // 触发 onSelect
  tabIndex={0}                        // 键盘可 focus
  onKeyDown={handleKeyDown}           // Enter/Space 触发 onSelect
  className={cn(
    "relative overflow-hidden rounded-xl border p-4 transition-all duration-300",
    "bg-card text-card-foreground group cursor-pointer",
    "hover:border-blue-500/50 hover:shadow-sm",
    isSelected && "border-blue-500/60 shadow-sm shadow-blue-500/10",
  )}
>
  {/* 选中态渐变层（绝对定位，仅选中时 opacity-100） */}
  <div className={cn(
    "absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none transition-opacity duration-500",
    isSelected ? "opacity-100" : "opacity-0",
  )} />

  {/* 主内容（相对定位，避免被渐变层遮挡） */}
  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    {/* 左：图标 + 标题 + 徽章 + 次级信息 */}
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* 图标方块容器：h-8 w-8 rounded-lg bg-muted + group-hover:scale-105 */}
      <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center border border-border group-hover:scale-105 transition-transform duration-300">
        <IconComponent className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {/* 标题 + 徽章 */}
        <div className="flex flex-wrap items-center gap-2 min-h-7">
          <h3 className="text-base font-semibold leading-none">{device.name}</h3>
          <DeviceStatusBadge status={device.status} />
        </div>
        {/* 次级信息行 */}
        <p className="text-sm text-muted-foreground truncate">
          {device.ip} · {device.mac} · {device.os}
        </p>
        {/* 配置摘要 */}
        <p className="text-xs text-muted-foreground/80 truncate">{device.configSummary}</p>
      </div>
    </div>

    {/* 右：操作按钮区（悬停淡入） */}
    <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200">
      <Button variant="ghost" size="icon" aria-label="详情" onClick={...}><Info className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="编辑" onClick={...}><Edit className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" aria-label="删除" onClick={...}><Trash2 className="h-4 w-4" /></Button>
    </div>
  </div>
</div>
```

**事件处理关键点：**

- `handleCardClick`：直接调 `onSelect(device)`。按钮的 `onClick` 内部调 `e.stopPropagation()` 阻止冒泡，避免点按钮误触发选中。
- `handleKeyDown`：`Enter` 或 `Space` 键触发 `onSelect`，并 `preventDefault` 避免 Space 滚动页面。
- 操作按钮本章节点击无实际效果，`onClick` 内部仅 `console.log`，预留接入点。

**依赖：** `lucide-react`（`Info` / `Edit` / `Trash2`）、`@/components/ui/button`、`@/components/DeviceStatusBadge`、`@/config/devices`（`DEVICE_TYPE_ICON`）、`@/lib/utils`（`cn`）、`@/types/device`。

### 3.5 设备页

**文件：** `src/pages/DevicesPage.tsx`（改造现有占位页）
**职责：** 管理选中状态、渲染标题区与卡片列表。
**内部状态：**

```ts
const [selectedId, setSelectedId] = useState<string | null>(null);
```

初始为 `null`（无选中），点击卡片后变为该设备 id。本章节不持久化。

**渲染结构：**

```tsx
<div className="space-y-6">
  {/* 标题区 */}
  <div>
    <h2 className="text-xl font-semibold">设备管理</h2>
    <p className="mt-1 text-sm text-muted-foreground">共 {MOCK_DEVICES.length} 台设备</p>
  </div>

  {/* 卡片列表 */}
  <div className="space-y-3">
    {MOCK_DEVICES.map((device) => (
      <DeviceCard
        key={device.id}
        device={device}
        isSelected={device.id === selectedId}
        onSelect={(d) => setSelectedId(d.id)}
      />
    ))}
  </div>
</div>
```

**空状态兜底（防御性，本章节不会触发）：**

```tsx
{MOCK_DEVICES.length === 0 && (
  <div className="px-6 py-8 text-center border border-dashed rounded-lg border-border text-muted-foreground">
    暂无设备
  </div>
)}
```

**依赖：** `react`（`useState`）、`@/components/DeviceCard`、`@/config/devices`（`MOCK_DEVICES`）。

### 3.6 UI 基础组件：Button

**文件：** `src/components/ui/button.tsx`
**职责：** shadcn 标准 Button，CVA 驱动 variant / size。
**对外接口：**

```ts
export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
export function Button(props: ButtonProps): React.ReactElement;
export const buttonVariants: ReturnType<typeof cva>;
```

**Variants：**

| variant | 用途 | className 核心 |
|---------|------|---------------|
| `default` | 主操作（本章节未用） | `bg-primary text-primary-foreground` |
| `destructive` | 危险操作（本章节未用） | `bg-destructive text-destructive-foreground` |
| `outline` | 次操作（本章节未用） | `border bg-background` |
| `secondary` | 次操作（本章节未用） | `bg-secondary text-secondary-foreground` |
| `ghost` | **图标按钮（本章节使用）** | `hover:bg-muted hover:text-foreground` |
| `link` | 链接样式（本章节未用） | `text-primary underline-offset-4` |

**Sizes：**

| size | className 核心 | 用途 |
|------|---------------|------|
| `default` | `h-10 px-4 py-2` | 普通按钮 |
| `sm` | `h-9 px-3` | 小按钮 |
| `lg` | `h-11 px-8` | 大按钮 |
| `icon` | `h-8 w-8 p-1`（与 cc-switch `iconButtonClass` 一致） | **图标按钮（本章节使用）** |

实现采用 shadcn 官方版本（`class-variance-authority` + `cn`），不引入 `@radix-ui/react-slot`（`asChild` 本章节不需要，用 `Slot` 会新增依赖；若未来需要可再装）。因此 `asChild` prop 保留类型签名但实现中**忽略并降级**为普通 button，附 JSDoc 说明。

### 3.7 UI 基础组件：Card

**文件：** `src/components/ui/card.tsx`
**职责：** shadcn 标准 Card 容器族（`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` / `CardAction`）。
**说明：** 本章节 DeviceCard 不强制使用此组件（见 1.2 取舍），但作为基础库成员沉淀，供后续章节（设置页、详情页）使用。实现采用 shadcn 官方 `React.forwardRef` + `className` 合并模式。

## 四、模块交互

### 4.1 渲染时序

```
App.tsx
  └─ ContentArea (activeTab="devices")
       └─ DevicesPage
            ├─ useState(selectedId)        ← 持有选中状态
            ├─ import MOCK_DEVICES          ← 读取固定数据
            └─ render DeviceCard × N       ← 遍历渲染
                  ├─ 读 DEVICE_TYPE_ICON    ← 取图标组件
                  ├─ render <Icon />        ← 图标方块
                  ├─ render <DeviceStatusBadge>
                  │    └─ 读 DEVICE_STATUS_STYLE ← 取配色
                  └─ render <Button>×3      ← 操作按钮（ui/button）
                       └─ buttonVariants     ← CVA 取样式
```

### 4.2 事件流

```
用户点击卡片主体
  → DeviceCard.handleCardClick
  → props.onSelect(device)
  → DevicesPage.setSelectedId(device.id)
  → React 重渲染
  → 该 DeviceCard isSelected=true → 蓝色边框 + 渐变层显现

用户点击右侧操作按钮
  → Button.onClick
  → e.stopPropagation()        ← 阻止冒泡到卡片
  → console.log(占位)           ← 本章节无实际行为
  （selectedId 不变）

用户按 Enter/Space（卡片聚焦时）
  → DeviceCard.handleKeyDown
  → preventDefault + onSelect(device)
  → 同点击效果
```

## 五、文件组织

```
src/
├── components/
│   ├── ui/
│   │   ├── tooltip.tsx          [已有] ch01 引入
│   │   ├── button.tsx           [新增] shadcn Button，CVA variants
│   │   └── card.tsx             [新增] shadcn Card 族，基础库沉淀
│   ├── DeviceCard.tsx           [新增] 设备卡片主体
│   └── DeviceStatusBadge.tsx    [新增] 状态徽章
├── config/
│   ├── constants.ts             [已有] ch01 常量
│   ├── nav.ts                   [已有] ch01 导航
│   └── devices.ts               [新增] MOCK_DEVICES + 图标/样式映射
├── pages/
│   └── DevicesPage.tsx          [修改] 从占位页改为卡片列表页
├── types/
│   └── device.ts                [新增] Device/DeviceType/DeviceStatus 类型
└── ...
```

## 六、技术决策

| 编号 | 决策点 | 选择 | 理由 |
|------|--------|------|------|
| D1 | 是否引入 `@radix-ui/react-slot` | **否** | shadcn Button 的 `asChild` 依赖 Slot，但本章节所有按钮都是原生 `<button>`，不需要多态渲染。保留 `asChild` 类型签名但实现中降级，避免新增依赖（spec N2 要求不引入新依赖）。 |
| D2 | DeviceCard 是否复用 `ui/card.tsx` | **否** | ProviderCard 的渐变层、状态边框、悬停 scale 是高度定制样式，塞进 shadcn Card 语义结构反而绕。`ui/card.tsx` 作为基础库成员存在，供后续章节使用。 |
| D3 | 图标方案 | **lucide-react 内置** | 不移植 cc-switch 的 80+ SVG 资源库（spec 5.2 明确排除）。lucide 已安装，`Laptop/Monitor/Server/Smartphone` 四个图标足够覆盖设备类型。 |
| D4 | 选中状态持久化 | **否** | spec 5.3 明确排除。区别于 ch01 的 `activeTab` 持久化，设备选中是临时交互状态，刷新后回到 `null`。 |
| D5 | 状态枚举形式 | **字面量联合类型** | `"online" \| "degraded" \| "offline"` 而非 `enum`，便于 JSON 序列化、i18n key 拼接、`Record<DeviceStatus, ...>` 映射。 |
| D6 | 操作按钮行为 | **`console.log` 占位** | spec 5.1 明确不做增删改。按钮保留视觉与事件接入点，点击仅打日志，便于后续章节接入真实逻辑。 |
| D7 | 选中态配色 | **Tailwind 原生 `blue-500`** | 与 SideNav 激活态配色一致（ch01 已确立），不污染 `--primary` 主题变量。 |
| D8 | 次级信息组合方式 | **单行 `·` 分隔 + `truncate`** | IP·MAC·OS 合并一行，避免占两行；`truncate` 保证窄屏不溢出。配置摘要单独成行，字号更小（`text-xs`）。 |
| D9 | 卡片布局响应式 | **`flex-col` → `sm:flex-row`** | 窄屏纵向（图标/信息/操作堆叠）、≥640px 横向（左信息 + 右操作）。与 cc-switch ProviderCard 完全一致。 |
| D10 | 键盘可访问性 | **`tabIndex={0}` + Enter/Space** | 卡片可 Tab 聚焦，Enter/Space 触发选中；操作按钮通过 `group-focus-within` 显现，保证纯键盘可用。 |

## 七、编码规范

**编程语言：** TypeScript / TSX（React 19 + Tailwind v4）

**适用的语言规范技能：** `ts-lang-spec`（开发执行者在开始编码前必须自动调用此技能，严格遵守其中的命名、注释、类型、导入规范）

**文件编码规则（ts-lang-spec 优先，以下为兜底）：**

- **新建文件**：UTF-8 无 BOM、LF 换行、文件末尾保留一个空行
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变。本章涉及的 `DevicesPage.tsx` 为 ch01 新建（UTF-8 LF），修改后仍按 UTF-8 LF 写回

**项目特定规范（来自 ch01 plan.md + 现有代码实证）：**

- **文件头版权注释**：所有新建 `.ts` / `.tsx` 文件必须带如下头部（日期填实际开发日）：

  ```
  /**
   * =====================================================
   * Copyright © sumu. 2026-present. All rights reserved.
   * File name  : <文件名>.tsx
   * Author     : sumu
   * Date       : 2026/07/21
   * Description: <一句话中文描述>
   * ======================================================
   */
  ```

- **组件声明**：用 `function` 声明（非箭头函数），显式标注 `: React.ReactElement` 返回类型
- **Props 接口命名**：`<组件名>Props`，每个字段加 JSDoc
- **导入顺序**：第三方库 → `@/` 别名（`import type` 单独一行）→ 相对路径，组间空行
- **常量**：全大写 SNAKE_CASE（应用级常量，如 `MOCK_DEVICES`、`DEVICE_TYPE_ICON`）
- **`as const`**：冻结固定数据数组（`MOCK_DEVICES` 用 `readonly Device[]` + `as const`）
- **`cn()` 工具**：所有条件化 className 必须经 `cn()` 合并，禁止字符串拼接
- **Tailwind 主题变量**：优先用 `bg-card` / `border-border` / `text-muted-foreground` 等语义变量；蓝色选中色用原生 `blue-500` / `blue-400`
- **暗色模式**：所有自定义颜色必须写 `dark:` 变体

---

*本文档由 code-spec 技能辅助生成*
