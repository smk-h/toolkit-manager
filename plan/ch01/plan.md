<!-- more -->

## 一、 架构概览

整体采用**单页面、单状态、视图分发**的极简架构——不引入路由库、不引入状态管理库，仅用一个 React state（`activeTab`）驱动整个界面切换。

### 1. 组件分层

```
App（根容器，持有 activeTab 状态）
├── Header                       # 顶部固定标题栏（纯展示）
├── SideNav                      # 左侧导航栏（触发 setActiveTab）
└── ContentArea                  # 右侧内容区（按 activeTab 分发页面）
    ├── DevicesPage
    ├── ProjectsPage
    ├── SettingsPage
    └── AboutPage
```

### 2. 数据流

单向、极简：

```
SideNav 点击 ──→ setActiveTab(tabId) ──→ App 重渲染
                                           ├── Header（不依赖 tab，不变化）
                                           ├── SideNav（高亮新激活的 tab）
                                           └── ContentArea（切换到新页面）
```

没有跨组件的复杂状态传递，没有全局 store。`activeTab` 是唯一驱动整个 UI 的状态。

### 3. 持久化

`activeTab` 的初始值从 `localStorage` 读取（带合法性校验），变化时写回 `localStorage`。封装在一个自定义 hook `useActiveTab` 中，组件无感。

## 二、 核心数据结构

### 1. `TabId` 类型

```ts
// 四个功能标签的唯一标识符
type TabId = "devices" | "projects" | "settings" | "about";
```

### 2. `NavItem` 接口

```ts
// 导航项的静态配置（图标、名称、标识）
interface NavItem {
  id: TabId;
  label: string;       // tooltip 与无障碍标签使用
  icon: LucideIcon;    // lucide-react 图标组件
}
```

### 3. `NAV_ITEMS` 常量

```ts
// 导航项配置数组（顺序即展示顺序）
// 设备、项目、设置在顶部；关于通过 flex 布局推到底部，不出现在此数组顺序的特殊处理中
const NAV_ITEMS: NavItem[] = [
  { id: "devices",  label: "设备", icon: Monitor },
  { id: "projects", label: "项目", icon: FolderKanban },
  { id: "settings", label: "设置", icon: Settings },
  { id: "about",    label: "关于", icon: Info },
];
```

### 4. `APP_META` 常量

```ts
// 应用元信息（关于页面使用，版本号从 package.json 注入）
const APP_META = {
  name: "toolkit-manager",
  version: APP_VERSION,  // 来自 import package.json 的 version 字段
} as const;
```

## 三、 模块设计

### 1. App（根容器）

**职责：**

- 持有 `activeTab` 状态（通过自定义 hook `useActiveTab`）
- 组装 Header / SideNav / ContentArea 三大区块
- 计算布局所需的内边距（标题栏固定，主内容需 `padding-top: 64px`）

**对外接口：** 无（根组件）

**依赖：** Header、SideNav、ContentArea、useActiveTab、APP_META

### 2. Header（标题栏）

**职责：**

- 渲染应用名称 `toolkit-manager`，品牌蓝色
- 固定定位（`fixed top-0`），半透明背景 + 毛玻璃模糊
- 本期右侧预留空白

**对外接口：** 无（纯展示组件）

**依赖：** 无

### 3. SideNav（侧边导航）

**职责：**

- 渲染四个导航项（遍历 `NAV_ITEMS`）
- 顶部三项（设备、项目、设置）顶部对齐
- 底部"关于"项通过 `mt-auto` 推到底部
- 每项展示图标，鼠标悬停显示 Tooltip（功能名称）
- 每项支持默认 / 悬停 / 激活三种视觉态
- 激活态左侧有品牌色竖条、图标变蓝
- 点击触发 `onSwitch(tabId)`

**对外接口：**

```ts
interface SideNavProps {
  activeTab: TabId;
  onSwitch: (tab: TabId) => void;
}
```

**依赖：** `NAV_ITEMS` 常量、Tooltip 组件（shadcn/ui）、`cn` 工具函数

### 4. ContentArea（内容区）

**职责：**

- 按 `activeTab` 值分发到对应页面组件
- 用 framer-motion 的 `AnimatePresence` 包裹，切换时淡入淡出（0.2s）
- 内层 `motion.div` 的 `key` 设为 `activeTab`，确保切换时重新挂载触发动画

**对外接口：**

```ts
interface ContentAreaProps {
  activeTab: TabId;
}
```

**依赖：** 四个页面组件、framer-motion

### 5. 四个页面组件

**DevicesPage / ProjectsPage / SettingsPage**：
- 共享同一个内部子组件 `PlaceholderPage`（props: `icon`、`title`、`hint`）
- 各自传入不同的图标、标题、提示文案

**AboutPage**：
- 独立实现，不使用 `PlaceholderPage`
- 展示：图标 → 项目名 → 版本号 → 提示文案
- 项目名和版本号取自 `APP_META`

**`PlaceholderPage` 接口：**

```ts
interface PlaceholderPageProps {
  icon: LucideIcon;
  title: string;
  hint: string;
}
```

### 6. useActiveTab（自定义 hook）

**职责：**

- 初始化时从 `localStorage` 读取（key: `toolkit-manager-active-tab`）
- 校验值合法性（必须在四个合法 `TabId` 范围内），非法则回退到 `"devices"`
- 返回 `[activeTab, setActiveTab]` 元组
- `setActiveTab` 内部同时写回 `localStorage`

**对外接口：**

```ts
function useActiveTab(): [TabId, (tab: TabId) => void];
```

**依赖：** `TabId` 类型、`localStorage`

## 四、 模块交互

### 1. 启动流程

```
main.tsx
  └── ReactDOM.render(<App />)
        └── App 调用 useActiveTab()
              └── 读取 localStorage
                    ├── 合法值 → 用作初始 activeTab
                    └── 非法或缺失 → 回退 "devices"
        └── 渲染 Header / SideNav(activeTab, setActiveTab) / ContentArea(activeTab)
```

### 2. 切换交互

```
用户点击 SideNav 某项
  └── 调用 setActiveTab(newTab)
        ├── 写入 localStorage
        └── 触发 App 重渲染
              ├── SideNav 收到新 activeTab → 高亮新项、取消旧项高亮
              └── ContentArea 收到新 activeTab
                    └── AnimatePresence 检测到 key 变化
                          ├── 旧 motion.div 淡出（0.2s）
                          └── 新 motion.div 淡入（0.2s）
```

### 3. 键盘快捷键（可选，F6）

```
用户按下 Ctrl+, 或 Cmd+,
  └── App 的 keydown 监听器触发
        └── 调用 setActiveTab("settings")
              └── 同"切换交互"流程
```

## 五、 文件组织

```
toolkit-manager/
├── package.json                        # 新增依赖（见技术决策 D2）
├── vite.config.ts                      # 修改：新增 @ 路径别名
├── tsconfig.json                       # 修改：新增 paths 路径映射
├── tailwind.config.js                  # 新建：Tailwind 配置（含 shadcn 主题变量）
├── postcss.config.js                   # 新建：PostCSS 配置（tailwind + autoprefixer）
├── components.json                     # 新建：shadcn/ui 配置
├── src/
│   ├── main.tsx                        # 修改：引入 index.css、移除模板相关
│   ├── App.tsx                         # 重写：从 Greet 模板改为根布局容器
│   ├── index.css                       # 新建：Tailwind 指令 + shadcn 主题变量
│   ├── App.css                         # 删除
│   ├── assets/
│   │   └── react.svg                   # 删除
│   ├── lib/
│   │   └── utils.ts                    # 新建：cn() 工具函数（shadcn 必需）
│   ├── config/
│   │   ├── nav.ts                      # 新建：TabId 类型、NavItem 接口、NAV_ITEMS、APP_META
│   │   └── constants.ts                # 新建：localStorage key、默认 tab、合法 tab 列表
│   ├── hooks/
│   │   └── useActiveTab.ts             # 新建：状态持久化 hook
│   ├── components/
│   │   ├── Header.tsx                  # 新建：顶部标题栏
│   │   ├── SideNav.tsx                 # 新建：左侧导航
│   │   ├── ContentArea.tsx             # 新建：内容区分发器
│   │   ├── PlaceholderPage.tsx         # 新建：占位页面（设备/项目/设置共用）
│   │   └── ui/
│   │       └── tooltip.tsx             # 新建：shadcn/ui Tooltip 组件
│   └── pages/
│       ├── DevicesPage.tsx             # 新建：设备页（占位）
│       ├── ProjectsPage.tsx            # 新建：项目页（占位）
│       ├── SettingsPage.tsx            # 新建：设置页（占位）
│       └── AboutPage.tsx               # 新建：关于页（含项目名 + 版本号）
└── src-tauri/
    └── src/
        └── lib.rs                      # 修改：移除 greet 命令
```

## 六、 技术决策

### D1：UI 样式方案 → Tailwind CSS

| 候选 | 评估 |
| --- | --- |
| **Tailwind CSS（选中）** | 参考项目 cc-switch 用的就是这个；原子化 class 写起来快；shadcn/ui 生态默认配合 Tailwind；暗色模式通过 `dark:` 前缀天然支持 |
| CSS Modules | 需要为每个组件单独写 css 文件，工作量大；shadcn/ui 不友好 |
| styled-components | 运行时开销；与 shadcn/ui 生态不匹配 |

### D2：组件库 → shadcn/ui（按需引入）

| 候选 | 评估 |
| --- | --- |
| **shadcn/ui（选中）** | 不是 npm 包，而是用 CLI 把组件源码拷进项目，完全可控；Tooltip 质量高；与 Tailwind 完美配合；参考项目用的就是这个 |
| Ant Design / MUI | 整包引入太重，风格强烈不易调成 cc-switch 那种克制风格 |
| 自己手写所有组件 | Tooltip 这种涉及定位的组件自己写不划算 |

**本期仅引入一个组件：`tooltip`**。其余视觉元素用 Tailwind class 直接写。

### D3：动画 → framer-motion

| 候选 | 评估 |
| --- | --- |
| **framer-motion（选中）** | 参考项目用的就是这个；`AnimatePresence` 处理组件进出场动画极其方便；声明式 API 写起来清爽 |
| CSS transition | 实现路由切换淡入淡出比较绕，需要手动管理 enter/exit 类名 |
| 不做动画 | 与 spec F3"页面切换时带短暂过渡动画"冲突 |

### D4：图标库 → lucide-react

| 候选 | 评估 |
| --- | --- |
| **lucide-react（选中）** | 参考项目用的就是这个；tree-shakeable，按需引入体积小；`Monitor`/`FolderKanban`/`Settings`/`Info` 四个图标齐全；与 shadcn/ui 默认配合 |
| Heroicons | 图标风格偏粗，与 cc-switch 视觉不匹配 |
| 自制 SVG | 维护成本高 |

### D5：版本号来源 → 直接 `import` package.json

| 候选 | 评估 |
| --- | --- |
| **import package.json（选中）** | tsconfig 已配 `resolveJsonModule: true`，可直接 `import pkg from "../package.json"`；零运行时成本；构建时打入 bundle；与 `pnpm sync-version` 工作流天然契合 |
| 通过 Tauri command 从 Rust 侧获取 | 需要新增后端命令；前后端版本号要分别维护；收益不抵成本 |
| 环境变量 `define` 注入 | 需要 Vite 配置额外维护；不如直接 import 直观 |

**实现位置：** `src/config/nav.ts` 中 `import pkg from "../../package.json"` 然后 `export const APP_VERSION = pkg.version`。

### D6：状态持久化 → localStorage + 自定义 hook

| 候选 | 评估 |
| --- | --- |
| **localStorage（选中）** | spec F5 明确要求"本地存储"；浏览器原生 API，零依赖；封装在 `useActiveTab` hook 中使用无感 |
| sessionStorage | spec F5 要求"关闭后恢复"，sessionStorage 关闭即丢，不符合 |
| Tauri Store plugin | 需要新增 Tauri 插件依赖；本期骨架不值当；后续真正做设置持久化时再考虑 |

### D7：路径别名 → 引入 `@/`

| 候选 | 评估 |
| --- | --- |
| **引入 `@/` 别名（选中）** | 参考项目用的就是这个；避免 `../../../` 嵌套地狱；shadcn/ui CLI 默认使用 `@/` |
| 相对路径 | 项目变大后 `../../lib/utils` 这种路径可读性差 |

**需要同步修改：** `vite.config.ts`（resolve.alias）+ `tsconfig.json`（compilerOptions.paths）。

### D8：Tailwind 主题色 → 复用 shadcn/ui 默认 CSS 变量

shadcn/ui 默认提供 `--background`、`--foreground`、`--primary` 等语义化 CSS 变量（亮/暗模式自适应），直接复用，不重新发明轮子。

品牌蓝色通过 Tailwind 原生的 `blue-500` / `blue-400`（dark）实现，不覆盖 `--primary` 变量，保持 shadcn 默认主色不被污染。

## 七、 编码规范

**编程语言：** TypeScript（前端）+ Rust（Tauri 后端，仅清理 greet 命令）

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（ts-lang-spec 优先，以下为兜底）：**

- **新建文件**：UTF-8 无 BOM、LF 换行
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变

**特别注意（针对本项目历史遗留）：**

- `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 当前均为 **CRLF 换行**（前序工作已确认）
- 本期涉及修改这些文件（如 package.json 加依赖），**必须保持 CRLF 不变**，否则会触发"幽灵 diff"
- 修改时优先使用 `pnpm` 命令（如 `pnpm add`）而非手动编辑，pnpm 会保持原换行符
- 新建的前端源文件统一用 LF 换行

开发阶段编写代码时，必须遵循 ts-lang-spec 中定义的编码风格、命名约定、注释规范等要求。开发执行者应在开始编码前自动调用该技能，并严格遵守上述文件编码规则。

---
*本文档由 markdowncli 技能辅助生成*
