<!-- more -->

# 设备卡片提取与展示 Spec

## 一、背景

### 1.1 当前状态

toolkit-manager 目前四个主页面（设备 / 项目 / 设置 / 关于）中，除"关于"页展示应用元信息外，其余三个均为 `PlaceholderPage` 占位实现，没有任何真实业务功能。侧边栏点击"设备"时，只显示一个大图标 + "该功能正在开发中"提示文案。

第一章（ch01）已完成界面骨架重构：三栏布局（Header + SideNav + ContentArea）、四个 TabId 路由、Tailwind v4 主题（shadcn HSL 变量）、framer-motion 页面切换动画。`src/components/ui/` 目录下已建立 shadcn 基础设施（目前仅有 `tooltip.tsx`），`class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react` 等依赖均已安装。

### 1.2 参考来源

本项目根目录下存在完整的 `cc-switch/` 源码（farion1231/cc-switch），其 `ProviderCard.tsx` 是一个设计成熟的卡片组件，具备以下视觉与交互特性：

- 圆角容器 + 主题化边框 + 选中态蓝色边框 / 渐变光晕
- 图标方块容器（`h-8 w-8 rounded-lg bg-muted`）+ 悬停 `scale-105` 微动效
- 标题 + 状态徽章群 + 次级信息（URL / 摘要）
- 右侧操作区悬停淡入显现
- 响应式布局（窄屏堆叠、宽屏横排）

但 `ProviderCard` 本身是一个**重业务组件**：依赖拖拽排序（@dnd-kit）、故障转移队列、用量查询 hook、健康检查 hook、代理接管状态、十几个回调与状态 props。直接照搬会带入 toolkit-manager 不需要的复杂度。

### 1.3 要解决的问题

将 cc-switch 的卡片**视觉骨架与交互模式**提炼为 toolkit-manager 可用的通用卡片形态，落地到设备页作为首个真实业务页面，验证"卡片式列表"这一展示范式在本项目是否成立，为后续章节（真实设备信息接入、增删改、持久化）打基础。

## 二、目标

- G1：让"设备"页从占位页升级为卡片列表页，展示若干固定设备信息
- G2：建立 toolkit-manager 自己的卡片组件，视觉与交互对标 cc-switch ProviderCard，但剔除全部业务依赖
- G3：沉淀 2 个基础 UI 组件（Card、Button），补齐 shadcn 组件库的第一批成员
- G4：验证选中态、悬停态、状态徽章三套交互模式在本项目的可用性
- G5：设备数据字段对齐未来真实接入（Tauri 系统接口），但本章节完全静态、不接后端

## 三、功能需求

### F1 设备页改造为卡片列表

**行为：** 用户点击侧边栏"设备"Tab，内容区不再显示占位页，而是渲染一组纵向排列的设备卡片（3-5 张），每张卡片代表一台设备。

**约束：**

- 卡片之间使用统一的垂直间距（12px 量级）
- 卡片列表整体在内容区内有合理内边距，不贴边
- 页面顶部预留一个标题区（"设备管理" + 设备数量小字），与卡片列表分离
- 当设备列表为空时（本章节不会发生，但接口要兼容）显示空状态占位

### F2 设备卡片内容

**行为：** 每张卡片从左到右、从上到下展示以下内容：

| 区域 | 内容 | 说明 |
|------|------|------|
| 图标方块 | 32×32 圆角方块，内嵌 lucide 设备类型图标 | 图标随设备 `type` 字段变化（如 `laptop` / `monitor` / `server`） |
| 主标题 | 设备名称（`name`） | `text-base font-semibold` |
| 状态徽章 | online / offline / degraded 三态 pill | 紧贴主标题右侧，颜色区分状态 |
| 次级信息行 | IP 地址 · MAC 地址 · 操作系统 | 灰色小字，单行省略 |
| 配置摘要 | CPU / 内存等一句话摘要（`configSummary`） | 灰色小字，置于次级信息下方 |
| 右侧操作区 | 2-3 个图标按钮（编辑 / 详情 / 删除） | 默认隐藏，悬停淡入 |

**约束：**

- 图标方块用 lucide-react 内置图标，**不**移植 cc-switch 的 80+ SVG 资源库
- 次级信息与配置摘要中的字段全部来自固定数据，本章不接 Tauri 接口

### F3 选中态交互

**行为：** 点击任意一张卡片的非按钮区域，将该卡片置为"选中"状态（单选，同时只能选中一张）。

**视觉表现（选中态）：**

- 卡片边框变为蓝色（`border-blue-500/60`）
- 卡片左侧出现从左到右的蓝色渐变背景层（`bg-gradient-to-r from-blue-500/10 to-transparent`）
- 卡片获得轻微阴影（`shadow-sm shadow-blue-500/10`）

**约束：**

- 再次点击已选中卡片不取消选中（本章节保持单选高亮，不做 toggle）
- 点击右侧操作按钮不触发选中（阻止事件冒泡）
- 选中状态仅存在于 React state，**不持久化**到 localStorage，刷新后回到默认（无选中或选中第一张）

### F4 悬停交互

**行为：** 鼠标悬停未选中的卡片时：

- 卡片边框颜色变为主题激活色（`hover:border-blue-500/50` 或主题等价色）
- 卡片获得轻微阴影（`hover:shadow-sm`）
- 右侧操作按钮组从 `opacity-0` 淡入到 `opacity-100`（200ms 过渡）
- 图标方块 `scale-105` 放大（300ms 过渡）

**约束：**

- 选中态的卡片在悬停时保持蓝色边框，不回退到默认悬停色
- 键盘 focus 卡片时（`group-focus-within`）也应显现操作按钮，保证可访问性

### F5 状态徽章系统

**行为：** 卡片标题右侧根据设备 `status` 字段显示一个 pill 形徽章：

| status | 文案 | 圆点色 | 背景色 | 文字色 |
|--------|------|--------|--------|--------|
| `online` | 在线 | 绿色 `bg-green-500` | `bg-green-500/10` | `text-green-600 dark:text-green-400` |
| `degraded` | 降级 | 黄色 `bg-yellow-500` | `bg-yellow-500/10` | `text-yellow-600 dark:text-yellow-400` |
| `offline` | 离线 | 红色 `bg-red-500` | `bg-red-500/10` | `text-red-600 dark:text-red-400` |

**结构：** pill 内含一个 `w-2 h-2 rounded-full` 的状态圆点 + 文案 `<span>`。

**约束：**

- 徽章基础样式：`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium`
- 文案走 i18n key（本章节先用中文硬编码兜底，预留 key 命名空间 `device.status.online` 等）

### F6 基础 UI 组件

**行为：** 新增两个 shadcn 风格的基础组件，供卡片与后续章节复用：

- **Card 组件**：`Card` / `CardHeader` / `CardContent` 等（标准 shadcn 拆分），基于 `bg-card text-card-foreground border rounded-lg`
- **Button 组件**：基于 `class-variance-authority`，支持 `variant`（default / outline / ghost / destructive）与 `size`（default / sm / icon）

**约束：**

- 放置在 `src/components/ui/` 下，与现有 `tooltip.tsx` 同级
- 遵循 shadcn 官方实现风格，不自行发明 API
- 设备卡片不强制使用 Card 组件（卡片样式较定制化，可直接用原生 div + Tailwind），但 Button 组件应被操作区按钮使用

## 四、非功能需求

### N1 编码规范

- 严格遵循 ts-lang-spec 技能要求
- 所有新建 `.ts` / `.tsx` 文件带 sumu 版权头（格式见 ch01 plan.md 第七章）
- 组件用 `function` 声明，显式标注 `: React.ReactElement` 返回类型
- Props 接口命名 `<组件名>Props`，每个字段加 JSDoc
- 导入分三组（第三方 / `@/` 别名 / 相对路径），组间空行

### N2 依赖与主题

- **不引入新 npm 依赖**：lucide-react、class-variance-authority、clsx、tailwind-merge 均已安装
- 复用 `src/lib/utils.ts` 的 `cn()` 工具
- 复用 `src/index.css` 已定义的 Tailwind v4 主题变量（`--card` / `--border` / `--muted` 等）
- 蓝色选中色直接用 Tailwind 原生 `blue-500` / `blue-400`（与 SideNav 激活态一致），不污染 `--primary`

### N3 暗色模式

- 所有用色必须写 `dark:` 变体，或使用主题变量自动适配
- 状态徽章三色均需在亮/暗模式下可读（已在 F5 表中给出 `dark:` 变体）

### N4 响应式

- 卡片内部布局：`flex-col`（窄屏纵向）→ `sm:flex-row`（≥640px 横向，左信息 + 右操作）
- 卡片列表容器在窄屏下保持单列

### N5 文件编码

- 新建文件：UTF-8 无 BOM、LF 换行、文件末尾保留一个空行
- 修改已有文件（`DevicesPage.tsx`）：保持原编码与换行符不变

### N6 可访问性

- 卡片可被键盘 focus（`tabIndex={0}`）
- 操作按钮有 `aria-label` 或 `title`
- 状态徽章的圆点用 `aria-hidden="true"`，状态信息由文案承载
- 选中态除颜色外，提供视觉冗余（边框粗细 / 阴影），不仅靠颜色区分

## 五、不做的事

### 5.1 明确排除的业务能力

- **不做拖拽排序**：不引入 @dnd-kit，卡片顺序由数据数组顺序决定
- **不做增删改**：本章节设备数据完全静态，无新增 / 编辑 / 删除 / 复制功能（操作按钮仅占位，点击无实际效果或仅 `console.log`）
- **不做搜索过滤**：卡片数量固定且少，不需要搜索框
- **不做用量 / 健康检查**：不移植 `UsageFooter`、`ProviderHealthBadge` 的数据查询 hook，徽章状态由静态字段决定

### 5.2 明确排除的移植内容

- **不移植 cc-switch 的 SVG 图标资源库**（`src/icons/extracted/` 80+ 文件）：用 lucide-react 内置图标替代
- **不移植 ProviderIcon 组件**：lucide 图标直接用 `<Icon className="h-5 w-5" />`
- **不移植 Provider 数据模型**：cc-switch 的 `Provider` 接口含 `settingsConfig` / `meta` 等重字段，toolkit-manager 定义自己的轻量 `Device` 类型
- **不移植 i18n 系统**：本章节文案中文硬编码，仅预留 key 命名空间

### 5.3 明确排除的持久化

- 选中状态不写 localStorage（区别于 ch01 的 `activeTab` 持久化）
- 设备数据不写 localStorage、不写文件系统

### 5.4 明确排除的真实接入

- 不调用 Tauri `system` / `network` 等接口获取真实 IP / MAC / OS
- 不做设备发现 / 扫描

## 六、验收标准

### AC1 设备页展示卡片列表

**验证：** 启动应用（`pnpm tauri dev` 或 `pnpm dev`），点击侧边栏"设备"Tab，内容区显示 3-5 张设备卡片纵向排列，顶部有"设备管理"标题与设备数量。

### AC2 卡片内容完整

**验证：** 每张卡片包含：图标方块（随设备类型变化）、设备名称、状态徽章、IP·MAC·OS 次级信息行、配置摘要、右侧操作按钮区。所有字段值来自代码中写死的固定数据。

### AC3 选中态切换正确

**验证：** 点击卡片 A 的非按钮区域 → A 显示蓝色边框 + 渐变光晕 + 阴影；再点击卡片 B → A 失去选中态、B 进入选中态。始终保持至多一张选中。点击右侧操作按钮不改变选中态。

### AC4 悬停态视觉反馈

**验证：** 鼠标悬停未选中卡片 → 边框变激活色、出现阴影、右侧操作按钮淡入、图标方块放大。移开鼠标 → 全部还原。Tab 键 focus 到卡片时操作按钮也显现。

### AC5 状态徽章三色区分

**验证：** 列表中至少包含一台 `online`（绿色徽章）、一台 `degraded`（黄色徽章）、一台 `offline`（红色徽章）设备，颜色与 F5 表定义一致。

### AC6 编译与类型检查通过

**验证：** 运行 `pnpm build`（等价于 `tsc && vite build`），无 TypeScript 错误、无 lint 报错、产物正常生成。

### AC7 暗色模式视觉正常

**验证：** 切换系统到暗色模式（或给 `<html>` 加 `.dark` 类），卡片背景 / 边框 / 文字 / 状态徽章均正确反色，蓝色选中态仍清晰可辨，无明显对比度问题。

### AC8 代码规范符合

**验证：** 新建文件均带版权头、function 声明组件、Props 接口含 JSDoc、导入分组有序；`cn()` 工具被复用；无任何新 npm 依赖被引入（`package.json` 的 dependencies 不变）。

---

*本文档由 code-spec 技能辅助生成*
