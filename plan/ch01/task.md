<!-- more -->

## 一、 文件清单

| 操作 | 文件 | 职责 |
| --- | --- | --- |
| 修改 | `package.json` | 新增 5 个依赖（pnpm add，保持 CRLF） |
| 新建 | `tailwind.config.js` | Tailwind 配置 + shadcn 主题变量 |
| 新建 | `postcss.config.js` | PostCSS 配置（tailwindcss + autoprefixer） |
| 新建 | `components.json` | shadcn/ui 配置（供其 CLI 识别） |
| 修改 | `vite.config.ts` | 新增 `@/` 路径别名 |
| 修改 | `tsconfig.json` | 新增 `paths` 路径映射 |
| 新建 | `src/index.css` | Tailwind 指令 + shadcn 主题变量（亮/暗） |
| 修改 | `src/main.tsx` | 引入 index.css |
| 删除 | `src/App.css` | 移除模板样式 |
| 删除 | `src/assets/react.svg` | 移除模板资源 |
| 重写 | `src/App.tsx` | 根布局容器（替代 Greet 模板） |
| 新建 | `src/lib/utils.ts` | `cn()` 工具函数 |
| 新建 | `src/config/nav.ts` | `TabId`、`NavItem`、`NAV_ITEMS`、`APP_META`、`APP_VERSION` |
| 新建 | `src/config/constants.ts` | localStorage key、默认 tab、合法 tab 集合 |
| 新建 | `src/hooks/useActiveTab.ts` | 状态持久化 hook |
| 新建 | `src/components/ui/tooltip.tsx` | shadcn/ui Tooltip 组件 |
| 新建 | `src/components/Header.tsx` | 顶部标题栏 |
| 新建 | `src/components/SideNav.tsx` | 左侧导航栏 |
| 新建 | `src/components/ContentArea.tsx` | 内容区分发器 |
| 新建 | `src/components/PlaceholderPage.tsx` | 占位页面（设备/项目/设置共用） |
| 新建 | `src/pages/DevicesPage.tsx` | 设备页 |
| 新建 | `src/pages/ProjectsPage.tsx` | 项目页 |
| 新建 | `src/pages/SettingsPage.tsx` | 设置页 |
| 新建 | `src/pages/AboutPage.tsx` | 关于页（含项目名 + 版本号） |
| 修改 | `src-tauri/src/lib.rs` | 移除 `greet` 命令 |

## 二、 任务列表

### T1：安装依赖

**文件：** `package.json`
**依赖：** 无
**步骤：**

1. 安装运行时依赖（保持 CRLF 换行）：
   ```bash
   pnpm add framer-motion lucide-react
   pnpm add @radix-ui/react-tooltip class-variance-authority clsx tailwind-merge
   ```
2. 安装开发依赖：
   ```bash
   pnpm add -D tailwindcss@^3 postcss autoprefixer
   ```
3. 校验 `package.json` 换行符未被破坏：
   ```bash
   od -c package.json | grep -c '\r'   # 数字应保持原值（每行一个 CRLF）
   ```

**说明：**

- **Tailwind 用 v3 而非 v4**：v4 配置方式大改，shadcn/ui 目前生态仍以 v3 为主，文档与 CLI 都基于 v3。稳妥起见用 v3。
- shadcn/ui 不通过 npm 安装，它的组件源码通过 CLI 或手动拷贝引入（T9 处理）。
- `@radix-ui/react-tooltip`、`class-variance-authority`、`clsx`、`tailwind-merge` 是 shadcn/ui Tooltip 组件的底层依赖。

**验证：** `pnpm install` 成功，`package.json` 的 dependencies/devDependencies 含上述包；`od -c` 显示换行符数量未变。

---

### T2：配置 Tailwind + PostCSS

**文件：** `tailwind.config.js`、`postcss.config.js`、`src/index.css`
**依赖：** T1
**步骤：**

1. 新建 `tailwind.config.js`，配置内容：
   - `darkMode: ["class"]`
   - `content: ["./index.html", "./src/**/*.{ts,tsx}"]`
   - `theme.extend` 引入 shadcn/ui 标准 CSS 变量映射（colors 用 `hsl(var(--xxx))` 形式）
   - 引入 keyframes（accordion down/up，shadcn/ui 标准要求）
2. 新建 `postcss.config.js`，plugins 含 `tailwindcss` 和 `autoprefixer`
3. 新建 `src/index.css`，包含：
   - Tailwind 三指令：`@tailwind base; @tailwind components; @tailwind utilities;`
   - `:root` 与 `.dark` 两个主题变量块（background/foreground/primary/muted 等标准变量，亮色和暗色各一组 HSL 值）
   - 全局 base 样式（`border-border`、`bg-background text-foreground`）

**验证：** 文件就位；`pnpm dev` 启动不报 PostCSS/Tailwind 相关错误。

---

### T3：配置路径别名

**文件：** `vite.config.ts`、`tsconfig.json`
**依赖：** 无
**步骤：**

1. 修改 `vite.config.ts`：
   - `import path from "node:path"`
   - `import { fileURLToPath } from "node:url"`
   - 在 `defineConfig` 内加 `resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }`
2. 修改 `tsconfig.json`：
   - 在 `compilerOptions` 内新增 `"baseUrl": "."`
   - 新增 `"paths": { "@/*": ["./src/*"] }`
3. **保持原文件换行符不变**（编辑前先 `od -c` 检查，编辑后复检）

**验证：** `pnpm dev` 启动无 TS 报错；后续代码 `import { cn } from "@/lib/utils"` 可正常解析。

---

### T4：创建 cn 工具函数

**文件：** `src/lib/utils.ts`
**依赖：** T1（clsx、tailwind-merge）
**步骤：**

1. 新建 `src/lib/utils.ts`
2. 导出 `cn` 函数：
   ```ts
   import { clsx, type ClassValue } from "clsx";
   import { twMerge } from "tailwind-merge";

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs));
   }
   ```

**验证：** 文件存在；后续任务能成功 `import { cn } from "@/lib/utils"`。

---

### T5：创建常量与类型定义

**文件：** `src/config/nav.ts`、`src/config/constants.ts`
**依赖：** T1（lucide-react）
**步骤：**

1. 新建 `src/config/constants.ts`：
   ```ts
   export const ACTIVE_TAB_STORAGE_KEY = "toolkit-manager-active-tab";
   export const DEFAULT_TAB = "devices" as const;
   export const VALID_TABS = ["devices", "projects", "settings", "about"] as const;
   ```
2. 新建 `src/config/nav.ts`：
   - `import pkg from "../../package.json"`（注意相对路径，因 nav.ts 在 src/config/ 下）
   - `export const APP_VERSION = pkg.version`
   - 定义 `TabId` 类型（联合字面量，取自 VALID_TABS）
   - 定义 `NavItem` 接口（id、label、icon: LucideIcon）
   - 定义 `APP_META` 常量（name: "toolkit-manager", version: APP_VERSION）
   - 定义 `NAV_ITEMS` 数组（四项：Monitor / FolderKanban / Settings / Info）

**验证：** TS 编译通过；`APP_VERSION` 值为 `"0.1.0"`。

---

### T6：实现 useActiveTab hook

**文件：** `src/hooks/useActiveTab.ts`
**依赖：** T5
**步骤：**

1. 新建 `src/hooks/useActiveTab.ts`
2. 实现 `useActiveTab`：
   - `useState` 初始化：从 localStorage 读 key `ACTIVE_TAB_STORAGE_KEY`，用 `VALID_TABS.includes` 校验，非法或缺失回退 `DEFAULT_TAB`
   - 自定义 setter：写入 state 同时 `localStorage.setItem(key, tab)`
   - 返回 `[activeTab, setActiveTab]` 元组

**验证：** 单元逻辑可手动验证（后续集成到 App 后由 checklist 覆盖）。

---

### T7：创建 shadcn/ui Tooltip 组件

**文件：** `src/components/ui/tooltip.tsx`
**依赖：** T1（@radix-ui/react-tooltip）、T4（cn）
**步骤：**

1. 新建 `src/components/ui/tooltip.tsx`
2. 直接采用 shadcn/ui 官方 Tooltip 组件源码（`TooltipProvider`、`Tooltip`、`TooltipTrigger`、`TooltipContent` 四个导出），样式通过 `cn()` 合并 Tailwind class
3. delayDuration 设为 500ms（spec F2 要求）

**验证：** 文件存在；后续 SideNav 能成功 import 四个组件。

---

### T8：实现 Header 组件

**文件：** `src/components/Header.tsx`
**依赖：** 无（纯展示）
**步骤：**

1. 新建 `src/components/Header.tsx`
2. 实现：
   - 容器 `fixed top-0 left-0 right-0 h-16 z-50`（64px = h-16）
   - `bg-background/80 backdrop-blur-md border-b`
   - 内层 `flex items-center px-6`
   - 左侧 `<h1>` 显示 `toolkit-manager`，class 含品牌蓝（`text-blue-500 dark:text-blue-400`）和字号字重（`text-lg font-semibold`）
   - 右侧预留空 `<div>`

**验证：** `pnpm dev` 启动后页面顶部能看到固定标题栏（后续集成验收）。

---

### T9：实现 SideNav 组件

**文件：** `src/components/SideNav.tsx`
**依赖：** T4（cn）、T5（NAV_ITEMS、TabId）、T7（Tooltip）
**步骤：**

1. 新建 `src/components/SideNav.tsx`
2. 实现 props `SideNavProps { activeTab: TabId; onSwitch: (tab: TabId) => void }`
3. 容器结构：
   - 外层 `fixed left-0 top-16 bottom-0 w-14`（56px = w-14，从标题栏下沿开始）
   - 内层 `flex flex-col items-center py-4`，右侧细边框 `border-r`
   - 上方三项（NAV_ITEMS 前 3 个）顶部对齐
   - "关于"项用 `<div className="mt-auto">` 包裹，推到底部
4. 每项渲染结构：
   - 用 `TooltipProvider + Tooltip + TooltipTrigger + TooltipContent` 包裹按钮
   - TooltipContent 显示 `item.label`
   - 按钮用 `<button>`，class 通过 `cn()` 拼接三态：
     - 基础：`w-10 h-10 flex items-center justify-center rounded-md transition-colors relative`
     - 激活：`bg-blue-500/10 text-blue-500 dark:text-blue-400` + 左侧竖条（`before:` 伪元素或额外 div 实现 `absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-500 rounded-r`）
     - 默认：`text-muted-foreground hover:bg-muted hover:text-foreground`
5. 点击调用 `onSwitch(item.id)`

**验证：** 渲染四个图标；点击能触发 `onSwitch`（由 App 接收）；hover 500ms 显示 tooltip。

---

### T10：实现 ContentArea 组件

**文件：** `src/components/ContentArea.tsx`
**依赖：** T5（TabId）、四个 Page 组件（T11-T14）、framer-motion
**步骤：**

1. 新建 `src/components/ContentArea.tsx`
2. props `ContentAreaProps { activeTab: TabId }`
3. 用 switch 返回当前 tab 对应的页面组件
4. 用 framer-motion `AnimatePresence mode="wait"` 包裹
5. 内层 `motion.div` 的 `key={activeTab}`、`initial={{ opacity: 0 }}`、`animate={{ opacity: 1 }}`、`exit={{ opacity: 0 }}`、`transition={{ duration: 0.2 }}`
6. 外层容器 `ml-14 mt-16 p-6 h-[calc(100vh-4rem)] overflow-auto`（左 56px 边距、顶部 64px 边距、剩余高度滚动）

**验证：** 切换 activeTab 时，内容区有淡入淡出动画。

---

### T11：实现 PlaceholderPage 组件

**文件：** `src/components/PlaceholderPage.tsx`
**依赖：** T1（lucide-react）
**步骤：**

1. 新建 `src/components/PlaceholderPage.tsx`
2. props `PlaceholderPageProps { icon: LucideIcon; title: string; hint: string }`
3. 渲染结构（全部居中）：
   - 外层 `flex flex-col items-center justify-center h-full`
   - 图标 `<Icon className="w-16 h-16 text-muted-foreground/50" />`（64×64，半透明灰）
   - 标题 `<h2 className="text-xl font-medium mt-4">`
   - 提示文案 `<p className="text-sm text-muted-foreground mt-2">`

**验证：** 组件可被设备/项目/设置三个页面复用。

---

### T12：实现三个占位页面

**文件：** `src/pages/DevicesPage.tsx`、`src/pages/ProjectsPage.tsx`、`src/pages/SettingsPage.tsx`
**依赖：** T11（PlaceholderPage）、T1（lucide-react）
**步骤：**

1. 三个文件结构相同，仅参数不同
2. 各自引入对应图标（`Monitor` / `FolderKanban` / `Settings`）并调用 `PlaceholderPage`：
   ```tsx
   // DevicesPage.tsx 示例
   import { Monitor } from "lucide-react";
   import { PlaceholderPage } from "@/components/PlaceholderPage";

   export function DevicesPage() {
     return (
       <PlaceholderPage
         icon={Monitor}
         title="设备管理"
         hint="该功能正在开发中，敬请期待。"
       />
     );
   }
   ```
3. 三个文件文案对应 spec F4 表格：设备管理 / 项目管理 / 应用设置

**验证：** 三个文件能被 `ContentArea` 成功引入和渲染。

---

### T13：实现 AboutPage 组件

**文件：** `src/pages/AboutPage.tsx`
**依赖：** T5（APP_META）、T1（lucide-react）
**步骤：**

1. 新建 `src/pages/AboutPage.tsx`
2. 不使用 `PlaceholderPage`（结构不同，需独立实现）
3. 渲染结构（居中）：
   - 外层 `flex flex-col items-center justify-center h-full`
   - 顶部大图标 `<Info className="w-16 h-16 text-muted-foreground/50" />`
   - 项目名 `<h2 className="text-2xl font-semibold mt-4">{APP_META.name}</h2>`（字号较大，大于普通文案）
   - 版本号 `<p className="text-base text-muted-foreground mt-1">版本 {APP_META.version}</p>`（字号小于项目名）
   - 提示文案 `<p className="text-sm text-muted-foreground mt-4">该功能正在开发中，敬请期待。</p>`

**验证：** 页面显示 `toolkit-manager` + `版本 0.1.0` + 提示文案。

---

### T14：重写 App.tsx

**文件：** `src/App.tsx`
**依赖：** T6（useActiveTab）、T8（Header）、T9（SideNav）、T10（ContentArea）
**步骤：**

1. 完全重写 `src/App.tsx`，移除 Greet 模板
2. 实现：
   - 调用 `const [activeTab, setActiveTab] = useActiveTab()`
   - 渲染：
     ```tsx
     <div className="min-h-screen bg-background text-foreground">
       <Header />
       <SideNav activeTab={activeTab} onSwitch={setActiveTab} />
       <ContentArea activeTab={activeTab} />
     </div>
     ```
3. 可选：F6 键盘快捷键——在 `useEffect` 中监听 `keydown`，`Ctrl/Cmd + ,` 触发 `setActiveTab("settings")`（防止在 input 中误触发）

**验证：** `pnpm dev` 启动后能看到完整三栏布局，点击导航能切换页面。

---

### T15：清理 main.tsx 与模板残留

**文件：** `src/main.tsx`、`src/App.css`（删除）、`src/assets/react.svg`（删除）
**依赖：** T14
**步骤：**

1. 修改 `src/main.tsx`：将 `import "./App.css"` 改为 `import "./index.css"`
2. 删除 `src/App.css`
3. 删除 `src/assets/react.svg`
4. 如 `src/assets/` 目录变空，删除该空目录

**验证：** `pnpm dev` 启动不报缺失模块错误。

---

### T16：清理 Tauri 后端 greet 命令

**文件：** `src-tauri/src/lib.rs`
**依赖：** 无
**步骤：**

1. 修改 `src-tauri/src/lib.rs`：
   - 删除 `greet` 函数定义
   - 删除 `.invoke_handler(tauri::generate_handler![greet])` 这一行（或改为 `generate_handler![]` 空数组，保留链式调用结构）
   - 删除顶部的 `// Learn more about Tauri commands ...` 注释
2. 保持其他代码不变（`tauri_plugin_opener::init()` 保留）

**验证：** `pnpm tauri dev` 启动成功，无编译错误；前端不再调用 `greet`。

---

## 三、 执行顺序

```
T1（装依赖）
  ├─→ T2（Tailwind 配置）
  ├─→ T3（路径别名）     ← 与 T2 并行
  └─→ T4（cn 工具）
        ↓
        T5（类型 + 常量）
        ├─→ T6（useActiveTab hook）
        └─→ T7（Tooltip 组件）
              ↓
              T8（Header）   ← 与 T9 并行
              T9（SideNav）
              T10（ContentArea）
              T11（PlaceholderPage）
                    ├─→ T12（三个占位页）
                    └─→ T13（AboutPage）
                          ↓
                          T14（重写 App）
                                ↓
                                T15（清理前端模板）
                                T16（清理后端 greet）  ← 与 T15 并行
                                      ↓
                                      集成验收（checklist.md）
```

**关键依赖链：** T1 → T4 → T5 → T7 → T9 → T10 → T14（最长的串行链）。
**可并行：** T2 ∥ T3；T8 ∥ T9 ∥ T10 ∥ T11；T15 ∥ T16。

---
*本文档由 markdowncli 技能辅助生成*
