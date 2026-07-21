<!-- more -->

# 设备卡片提取与展示 Tasks

## 一、文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/types/device.ts` | `Device` / `DeviceType` / `DeviceStatus` 类型定义 |
| 新建 | `src/config/devices.ts` | `MOCK_DEVICES` 固定数据 + `DEVICE_TYPE_ICON` / `DEVICE_STATUS_STYLE` 映射 |
| 新建 | `src/components/ui/button.tsx` | shadcn Button（CVA variants，不依赖 Slot） |
| 新建 | `src/components/ui/card.tsx` | shadcn Card 族（基础库沉淀，本章节备用） |
| 新建 | `src/components/DeviceStatusBadge.tsx` | 状态徽章组件（三色 pill） |
| 新建 | `src/components/DeviceCard.tsx` | 设备卡片主体（移植自 ProviderCard） |
| 修改 | `src/pages/DevicesPage.tsx` | 从占位页改为卡片列表页 |

## 二、任务列表

### T1: 新建设备类型定义

**文件：** `src/types/device.ts`
**依赖：** 无
**步骤：**

1. 新建 `src/types/device.ts`（UTF-8 LF + 版权头）
2. 定义 `DeviceStatus = "online" | "degraded" | "offline"` 字面量联合，加 JSDoc
3. 定义 `DeviceType = "laptop" | "desktop" | "server" | "mobile"` 字面量联合，加 JSDoc
4. 定义 `Device` 接口，8 个字段（id / name / type / status / ip / mac / os / configSummary），每个字段加 JSDoc

**验证：** `pnpm tsc --noEmit` 通过（新文件无语法/类型错误）

---

### T2: 新建设备配置数据

**文件：** `src/config/devices.ts`
**依赖：** T1
**步骤：**

1. 新建 `src/config/devices.ts`（UTF-8 LF + 版权头）
2. 从 `lucide-react` 导入 `Laptop`、`Monitor`、`Server`、`Smartphone`、`type LucideIcon`
3. 定义 `DEVICE_TYPE_ICON: Record<DeviceType, LucideIcon>`，四种类型映射到对应图标，`as const`
4. 定义 `DeviceStatusStyle` 接口（label / dotClass / bgClass / textClass 四字段，各加 JSDoc）
5. 定义 `DEVICE_STATUS_STYLE: Record<DeviceStatus, DeviceStatusStyle>`，三态样式严格按 plan.md 2.5 节表（绿色/黄色/红色 + dark 变体）
6. 定义 `MOCK_DEVICES: readonly Device[]`，按 plan.md 3.2 节表写死 5 台设备数据（dev-001 到 dev-005，覆盖 4 种类型 + 3 种状态）

**验证：** `pnpm tsc --noEmit` 通过；`MOCK_DEVICES.length === 5`；数据中至少含 1 台 `online` / 1 台 `degraded` / 1 台 `offline`

---

### T3: 新建 Button 基础组件

**文件：** `src/components/ui/button.tsx`
**依赖：** 无（独立基础组件）
**步骤：**

1. 新建 `src/components/ui/button.tsx`（UTF-8 LF + 版权头）
2. 导入 `cva` from `class-variance-authority`、`cn` from `@/lib/utils`、`type { VariantProps }`
3. 定义 `buttonVariants = cva(...)`，按 plan.md 3.6 节配置：
   - base: `"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"`
   - variants: `default` / `destructive` / `outline` / `secondary` / `ghost` / `link`（按 plan.md 3.6 表）
   - size: `default` / `sm` / `lg` / `icon`（`icon` 用 `h-8 w-8 p-1` 对齐 cc-switch `iconButtonClass`）
4. 定义 `ButtonProps` 接口，`extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants>`，含 `asChild?: boolean`（JSDoc 注明本章节降级忽略，需 Slot 时再装依赖）
5. 实现 `Button({ variant, size, asChild, className, ...props })`：用 `function Button(...): React.ReactElement` 声明，返回 `<button className={cn(buttonVariants({ variant, size, className }))} {...props} />`。**不实现 asChild 多态**（忽略 `asChild` 值，始终渲染 button），附注释说明降级理由
6. 末尾 `export { Button, buttonVariants }`

**验证：** `pnpm tsc --noEmit` 通过；能在测试代码中 `<Button variant="ghost" size="icon"><X /></Button>` 正常渲染（手动 import 验证）

---

### T4: 新建 Card 基础组件

**文件：** `src/components/ui/card.tsx`
**依赖：** 无（独立基础组件）
**步骤：**

1. 新建 `src/components/ui/card.tsx`（UTF-8 LF + 版权头）
2. 导入 `React`、`cn` from `@/lib/utils`
3. 按官方实现定义容器族，全部用 `React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>` + `className={cn("...", className)}`：
   - `Card`：`rounded-xl border bg-card text-card-foreground shadow`
   - `CardHeader`：`flex flex-col space-y-1.5 p-6`
   - `CardTitle`：`font-semibold leading-none tracking-tight`
   - `CardDescription`：`text-sm text-muted-foreground`
   - `CardContent`：`p-6 pt-0`
   - `CardFooter`：`flex items-center p-6 pt-0`
   - `CardAction`：`flex items-center`（shadcn 较新版才有）
4. 每个组件加 JSDoc；末尾 `export { Card, CardHeader, ... }`

**验证：** `pnpm tsc --noEmit` 通过（本章节不实际使用，仅作基础库沉淀）

---

### T5: 新建 DeviceStatusBadge 组件

**文件：** `src/components/DeviceStatusBadge.tsx`
**依赖：** T1、T2
**步骤：**

1. 新建 `src/components/DeviceStatusBadge.tsx`（UTF-8 LF + 版权头）
2. 导入 `cn` from `@/lib/utils`、`DEVICE_STATUS_STYLE` from `@/config/devices`、`type { DeviceStatus }` from `@/types/device`
3. 定义 `DeviceStatusBadgeProps` 接口：`status: DeviceStatus` + `className?: string`，字段加 JSDoc
4. 实现 `function DeviceStatusBadge({ status, className }: DeviceStatusBadgeProps): React.ReactElement`：
   - `const style = DEVICE_STATUS_STYLE[status]`
   - 返回 `<span>` 结构按 plan.md 3.3 节：基础 `inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium` + `style.bgClass` + `style.textClass` + `className`
   - 内含 `<span aria-hidden="true" className={cn("w-2 h-2 rounded-full", style.dotClass)} />`
   - 内含 `<span>{style.label}</span>`

**验证：** `pnpm tsc --noEmit` 通过；手动渲染 `<DeviceStatusBadge status="online" />` 应输出带绿色圆点 + "在线" 文案的 pill

---

### T6: 新建 DeviceCard 组件

**文件：** `src/components/DeviceCard.tsx`
**依赖：** T1、T2、T3、T5
**步骤：**

1. 新建 `src/components/DeviceCard.tsx`（UTF-8 LF + 版权头）
2. 导入 `Info`、`Edit`、`Trash2` from `lucide-react`；`cn` from `@/lib/utils`；`Button` from `@/components/ui/button`；`DeviceStatusBadge` from `@/components/DeviceStatusBadge`；`DEVICE_TYPE_ICON` from `@/config/devices`；`type { Device }` from `@/types/device`
3. 定义 `DeviceCardProps` 接口：`device: Device` + `isSelected: boolean` + `onSelect: (device: Device) => void`，字段加 JSDoc
4. 实现 `function DeviceCard({ device, isSelected, onSelect }: DeviceCardProps): React.ReactElement`：
   - `const IconComponent = DEVICE_TYPE_ICON[device.type]`
   - 定义 `handleCardClick = () => onSelect(device)`
   - 定义 `handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(device); } }`
   - 定义 `handleActionClick = (e: React.MouseEvent) => { e.stopPropagation(); }`（内部 `console.log` 占位）
   - JSX 结构严格按 plan.md 3.4 节模板：外层 div（选中态边框 + 渐变层 + 主内容 flex 布局 + 图标方块 + 标题徽章 + 次级信息 + 配置摘要 + 右侧操作按钮区）
   - 操作按钮 3 个：详情（Info）/ 编辑（Edit）/ 删除（Trash2），均用 `<Button variant="ghost" size="icon" onClick={handleActionClick} aria-label="...">`

**验证：** `pnpm tsc --noEmit` 通过；`isSelected=true` 时 className 含 `border-blue-500/60`；`isSelected=false` 时含 `hover:border-blue-500/50`

---

### T7: 改造 DevicesPage

**文件：** `src/pages/DevicesPage.tsx`
**依赖：** T2、T6
**步骤：**

1. 读取现有 `src/pages/DevicesPage.tsx` 确认编码（应为 UTF-8 LF）
2. 完全重写文件内容（保持 UTF-8 LF + 原版权头日期不变或更新为今日）：
   - 移除 `Monitor` 导入与 `PlaceholderPage` 导入
   - 导入 `useState` from `react`；`DeviceCard` from `@/components/DeviceCard`；`MOCK_DEVICES` from `@/config/devices`
3. 实现 `function DevicesPage(): React.ReactElement`：
   - `const [selectedId, setSelectedId] = useState<string | null>(null)`
   - 返回结构按 plan.md 3.5 节：标题区（h2 "设备管理" + 小字 "共 N 台设备"）+ 卡片列表（`space-y-3` 容器 + `MOCK_DEVICES.map` 渲染 `DeviceCard`）+ 空状态兜底（`length === 0` 时显示 "暂无设备"）
   - `DeviceCard` 的 `onSelect` 回调：`(d) => setSelectedId(d.id)`
4. 保留原有的版权头格式与 Description 字段（可改为"设备管理页（卡片列表）"）

**验证：** `pnpm tsc --noEmit` 通过；`pnpm build` 成功生成产物

---

### T8: 集成编译与视觉验证

**文件：** 全项目
**依赖：** T7
**步骤：**

1. 运行 `pnpm tsc --noEmit`，确认无任何 TS 错误
2. 运行 `pnpm build`，确认 Vite 产物正常生成
3. 运行 `pnpm dev` 或 `pnpm tauri dev`，人工验证：
   - 点击侧边栏"设备"Tab，看到 5 张卡片
   - 三种状态徽章颜色正确（绿/黄/红）
   - 点击卡片切换蓝色选中态
   - 悬停卡片显现右侧操作按钮 + 图标方块放大
   - 暗色模式下视觉正常

**验证：** 上述 5 项全部符合预期；编译与构建无 error/warning

## 三、执行顺序

```
T1 ──→ T2 ──┐
            ├─→ T5 ──┐
T3 ─────────┘        ├─→ T6 ──→ T7 ──→ T8
T4（独立，可并行）─────────────────────────↗
```

**依赖说明：**

- **T1（类型）** 是所有业务文件的根依赖，必须最先完成
- **T3（Button）/ T4（Card）** 是独立 UI 基础组件，互不依赖，可与 T1/T2 并行
- **T2（数据）** 依赖 T1；**T5（徽章）** 依赖 T1+T2
- **T6（卡片）** 依赖 T1+T2+T3+T5，是业务层核心
- **T7（页面）** 依赖 T2+T6
- **T8（集成验证）** 必须最后

**建议执行序列：** `T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8`（线性，最稳妥）

## 四、风险与注意事项

| 风险 | 应对 |
|------|------|
| Tailwind v4 与 shadcn Button 的 `focus-visible:ring-ring` 不生效 | 已确认 `--ring` 主题变量在 `index.css` 已定义，v4 `@theme inline` 已映射 |
| `asChild` 类型签名与实现不一致引发 TS 报错 | `ButtonProps` 中 `asChild?: boolean` 可选，实现中忽略其值，TS 不会报错（只是运行时无效） |
| 操作按钮 `onClick` 内 `console.log` 在生产构建中被 tree-shake | 不影响功能，仅占位；后续章节替换为真实回调即可 |
| `MOCK_DEVICES` 用 `as const` 导致类型过窄 | 用 `readonly Device[]` 类型标注 + 普通数组字面量，不用 `as const`（避免字面量类型污染） |
| 修改 `DevicesPage.tsx` 时破坏原编码 | 该文件为 ch01 新建的 UTF-8 LF，写回时保持 UTF-8 LF 即可 |

---

*本文档由 code-spec 技能辅助生成*
