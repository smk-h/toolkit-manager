<!-- more -->

# 设备卡片提取与展示 Checklist

> 每一项通过运行代码或观察行为来验证，聚焦系统行为。验收时逐项执行，记录实际结果与证据。

## 一、实现完整性

- [ ] **类型定义存在**（验证：`src/types/device.ts` 文件存在，导出 `Device` / `DeviceType` / `DeviceStatus` 三个类型，`pnpm tsc --noEmit` 通过）
- [ ] **固定数据就绪**（验证：`src/config/devices.ts` 导出 `MOCK_DEVICES`，长度为 5，覆盖 laptop/desktop/server/mobile 四种类型与 online/degraded/offline 三种状态——至少 1 台 online、1 台 degraded、1 台 offline）
- [ ] **Button 组件可用**（验证：`src/components/ui/button.tsx` 导出 `Button` 与 `buttonVariants`，支持 `variant` 含 `default/destructive/outline/secondary/ghost/link`、`size` 含 `default/sm/lg/icon`）
- [ ] **Card 组件可用**（验证：`src/components/ui/card.tsx` 导出 `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`，`pnpm tsc --noEmit` 通过）
- [ ] **状态徽章组件可用**（验证：`src/components/DeviceStatusBadge.tsx` 导出 `DeviceStatusBadge`，接收 `status` 与可选 `className`）
- [ ] **设备卡片组件可用**（验证：`src/components/DeviceCard.tsx` 导出 `DeviceCard`，接收 `device` / `isSelected` / `onSelect` 三个 props）

## 二、集成

- [ ] **设备页已接入卡片**（验证：`src/pages/DevicesPage.tsx` 不再 import `PlaceholderPage`，改为 import `DeviceCard` 与 `MOCK_DEVICES`；渲染标题区 + 卡片列表）
- [ ] **选中状态链路通畅**（验证：在 `DevicesPage` 中点击卡片 A，A 的 `isSelected` 变为 true；点击 B，A 失去选中、B 进入选中——通过 React DevTools 或视觉观察）
- [ ] **状态徽章被卡片使用**（验证：`DeviceCard` 内 import 并渲染了 `DeviceStatusBadge`，传入 `device.status`）
- [ ] **Button 被操作区使用**（验证：`DeviceCard` 右侧操作按钮区至少 3 个 `<Button variant="ghost" size="icon">`，含 `aria-label`）
- [ ] **图标映射生效**（验证：`MOCK_DEVICES` 中 type 为 laptop 的卡片图标是 `Laptop`，desktop 是 `Monitor`，server 是 `Server`，mobile 是 `Smartphone`——视觉观察或 DevTools 检查）

## 三、编译与测试

- [ ] **TypeScript 类型检查通过**（验证：运行 `pnpm tsc --noEmit`，退出码 0，无任何 error）
- [ ] **Vite 构建成功**（验证：运行 `pnpm build`，`dist/` 目录生成产物，无构建错误）
- [ ] **无未使用变量告警**（验证：`tsconfig.json` 已开启 `noUnusedLocals` / `noUnusedParameters`，编译通过即代表无未使用项）
- [ ] **未引入新 npm 依赖**（验证：对比 `package.json` 的 `dependencies` 与 `devDependencies`，与本章开发前一致——无 `@radix-ui/react-slot`、无其他新增）
- [ ] **代码符合 ts-lang-spec 规范**（验证：人工抽查——所有新建文件带版权头、组件用 `function` 声明 + `: React.ReactElement`、Props 接口命名 `<组件名>Props` 且字段有 JSDoc、导入分三组）
- [ ] **文件编码未被破坏**（验证：新建文件为 UTF-8 无 BOM、LF 换行；修改的 `DevicesPage.tsx` 保持 UTF-8 LF——用编辑器或 `file` 命令核对，无乱码）
- [ ] **`cn()` 工具被复用**（验证：所有条件化 className 均经 `cn()` 合并，无字符串模板拼接）

## 四、端到端场景

### 场景 1：首次进入设备页

**操作：** 启动应用 → 点击侧边栏"设备"Tab
**预期：** 内容区显示"设备管理"标题 + "共 5 台设备"小字；下方纵向排列 5 张设备卡片；首屏无卡片被选中（全部为默认边框色）

### 场景 2：选中卡片

**操作：** 在设备页点击第 2 张卡片（Windows 工作站）的非按钮区域
**预期：** 该卡片出现蓝色边框（`border-blue-500/60`）+ 左侧蓝色渐变背景层 + 轻微阴影；其余卡片保持默认态

### 场景 3：切换选中

**操作：** 在场景 2 基础上，点击第 3 张卡片（Ubuntu 构建服务器）
**预期：** 第 2 张卡片蓝色选中态消失，恢复默认；第 3 张卡片进入蓝色选中态；始终保持至多一张选中

### 场景 4：点击操作按钮不改变选中

**操作：** 选中第 1 张卡片后，点击第 2 张卡片右侧的"编辑"图标按钮
**预期：** 选中状态保持在第 1 张卡片不变；控制台输出 `console.log` 占位日志；不抛出错误

### 场景 5：悬停视觉反馈

**操作：** 鼠标悬停未选中的第 4 张卡片（测试服务器）
**预期：** 卡片边框变为 `blue-500/50`；出现轻微阴影；右侧 3 个操作按钮（详情/编辑/删除）从透明淡入显现；左侧图标方块放大（`scale-105`）。移开鼠标全部还原

### 场景 6：键盘可访问性

**操作：** 按 `Tab` 键将焦点移到某张卡片 → 按 `Enter`（或 `Space`）
**预期：** Tab 过程中卡片可通过键盘获得焦点（焦点可见）；按下 Enter/Space 后该卡片进入选中态（与鼠标点击效果一致）；Space 不触发页面滚动

### 场景 7：状态徽章三色

**操作：** 观察设备页 5 张卡片的状态徽章
**预期：** dev-001（MacBook Pro）与 dev-002（Windows 工作站）显示绿色"在线"徽章；dev-003（Ubuntu 构建服务器）显示黄色"降级"徽章；dev-004（测试服务器）与 dev-005（iPhone 15）显示红色"离线"徽章

### 场景 8：暗色模式

**操作：** 切换系统到暗色模式（或临时给 `<html>` 加 `class="dark"`）
**预期：** 卡片背景、边框、文字、次级信息均正确反色；状态徽章三色在暗色下可读（绿/黄/红的 `dark:` 变体生效）；蓝色选中态在暗色背景下仍清晰可辨；无大面积同色融合或对比度不足

### 场景 9：响应式布局

**操作：** 缩小浏览器/应用窗口宽度到 < 640px（或用 DevTools 切到移动端视图）
**预期：** 卡片内部从横向（左信息 + 右操作）切换为纵向堆叠（图标 + 信息在上，操作按钮区在下）；卡片列表保持单列；次级信息与配置摘要的 `truncate` 生效，不溢出

## 五、范围边界核对（不应出现的能力）

> 这些是 spec 明确排除的，验收时确认它们**不存在**，避免范围蔓延。

- [ ] **未引入拖拽排序**（验证：`DeviceCard` 无 `@dnd-kit` 相关 import，卡片无拖拽手柄）
- [ ] **未做增删改**（验证：操作按钮点击无实际数据变动，仅 `console.log`；`MOCK_DEVICES` 运行时不可变）
- [ ] **未做搜索过滤**（验证：设备页无搜索输入框）
- [ ] **未移植 cc-switch 图标库**（验证：`src/icons/` 目录不存在或为空；卡片图标全部来自 `lucide-react`）
- [ ] **未接入 Tauri 系统接口**（验证：`src-tauri/` 无新增 Rust 代码；`MOCK_DEVICES` 为静态字面量）
- [ ] **选中状态未持久化**（验证：刷新页面后选中态回到默认 null；`localStorage` 无相关 key 写入）

---

*本文档由 code-spec 技能辅助生成*
