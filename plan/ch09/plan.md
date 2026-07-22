# 配置文件手动刷新 Plan

## 架构概览

在 ch08 全局 MCP 开关的基础上,新增「手动刷新」能力。**纯前端实现**,不新增依赖、不改 Rust 后端、不改 lib 纯逻辑层。改动集中在视图层信号透传与状态驱动:

1. **信号源**(App.tsx)——持有 `refreshTick` 计数器,Header 按钮点击时递增;同时重读全局 MCP 状态
2. **信号透传**(ContentArea.tsx)——把 `refreshTick` 透传给当前页签对应的页面
3. **信号响应-设备页**(DevicesPage.tsx)——监听 `refreshTick` 变化,调既有 `useDevices.reload()`
4. **信号响应-项目页**(ProjectsPage.tsx + ProjectCard.tsx)——`refreshTick` 作为 `refreshKey` 透传给所有 ProjectCard,驱动 MCP 状态检测 effect 重跑
5. **入口渲染**(Header.tsx)——devices/projects 页签各渲染一个刷新按钮,含旋转动画

利用 `ContentArea` 的 `key={activeTab}` 机制:切换页签时旧页面卸载、新页面挂载,**任何时刻只有当前页签的页面在监听 refreshTick**,因此单一计数器即可,无需区分目标页签。

```
App (refreshTick, isRefreshing 不在此层)
  │
  ├─→ Header (onRefresh 回调, 内部持有 isRefreshing 做旋转动画)
  │     ├─ devices: [↻ 刷新] [+ 新增设备]
  │     └─ projects: [全局 MCP ○] [↻] [+ 新增项目]
  │
  └─→ ContentArea (refreshTick)
        ├─→ DevicesPage (useEffect 监听 refreshTick → reload)
        └─→ ProjectsPage (refreshTick → 透传 refreshKey 给 ProjectCard)
              └─→ ProjectCard (状态检测 effect 依赖新增 refreshKey)
```

## 核心数据结构

无新增数据结构。复用既有的判别联合与计数器模式:

- `refreshTick: number`——App 层持有的刷新计数器,初始 0,每次点击刷新递增 1。仅当 `refreshTick > 0` 时页面才响应(避免首次挂载重复加载,满足 N4)
- `refreshKey: number`——透传到 ProjectCard 的别名,语义与 refreshTick 相同,仅命名贴近「驱动重新检测」的语义
- `isRefreshing: boolean`——Header 内部局部状态,控制图标旋转动画,与数据加载无耦合(固定 500ms 后关闭)

## 核心接口

### 新增 / 修改的 Props

```ts
/** Header 新增 */
interface HeaderProps {
  // ... 既有 props
  /** 刷新按钮点击回调(递增 refreshTick + 重读全局 MCP) */
  onRefresh: () => void;
}

/** ContentArea 新增 */
interface ContentAreaProps {
  // ... 既有 props
  /** 刷新计数器,透传给当前页签页面 */
  refreshTick: number;
}

/** DevicesPage 新增 */
interface DevicesPageProps {
  // ... 既有 props
  /** 刷新计数器,>0 时触发 reload */
  refreshTick: number;
}

/** ProjectsPage 新增 */
interface ProjectsPageProps {
  // ... 既有 props
  /** 刷新计数器,透传给 ProjectCard 作为 refreshKey */
  refreshTick: number;
}

/** ProjectCard 新增 */
interface ProjectCardProps {
  // ... 既有 props
  /** 刷新信号,变化时重新检测 MCP 状态(外部改了 .mcp.json 但路径未变时驱动重检测) */
  refreshKey: number;
}
```

### 复用既有接口

- `useDevices().reload()` (`hooks/useDevices.ts:56`)——设备页刷新的核心,递增内部 `reloadCount` 驱动 effect 重读 YAML
- `detectGlobalMcp()` (`lib/globalMcp.ts`)——全局 MCP 刷新,重读 `~/.claude.json` 判定 embedded-board 存在性

## 模块设计

### App.tsx(修改)
**职责:** 持有 `refreshTick` 状态,提供 `handleRefresh` 编排刷新动作。
**新增逻辑:**
- `const [refreshTick, setRefreshTick] = useState(0)`
- `handleRefresh`:递增 `refreshTick` + 异步重读 `detectGlobalMcp()` 更新 `globalMcpChecked`(满足 F5:项目页刷新时同步全局 MCP 状态)
- 透传 `onRefresh={handleRefresh}` 给 Header,`refreshTick={refreshTick}` 给 ContentArea
**依赖:** `detectGlobalMcp`(既有)、`useState`/`useCallback`

### Header.tsx(修改)
**职责:** 渲染刷新按钮 + 旋转动画。
**新增逻辑:**
- 新增 `onRefresh: () => void` prop
- 内部 `const [isRefreshing, setIsRefreshing] = useState(false)`
- `handleRefreshClick`:`setIsRefreshing(true)` + 调 `onRefresh()` + `setTimeout(() => setIsRefreshing(false), 500)`
- devices 分支(`activeTab === "devices"`):在「新增设备」按钮**前**渲染刷新按钮(ghost + sm + RefreshCw 图标 + 「刷新」文字)
- projects 分支(`activeTab === "projects"`):在 `GlobalMcpSwitch` 和「新增项目」按钮**之间**渲染纯图标刷新按钮(ghost + icon + RefreshCw)
- 图标加 `animate-spin` class 当 `isRefreshing` 为 true
- settings/about 分支:不渲染刷新按钮(满足 F7)
**依赖:** `RefreshCw` from `lucide-react`(既有依赖,无需安装)、`cn` from `@/lib/utils`、`Button`、`useState`

### ContentArea.tsx(修改)
**职责:** 透传 `refreshTick` 给当前页签页面。
**新增逻辑:**
- `ContentAreaProps` 新增 `refreshTick: number`
- `renderPage` 签名新增 `refreshTick` 参数
- devices 分支:`<DevicesPage ... refreshTick={refreshTick} />`
- projects 分支:`<ProjectsPage ... refreshTick={refreshTick} />`
**依赖:** 无新增

### DevicesPage.tsx(修改)
**职责:** 监听 `refreshTick`,触发设备列表重读。
**新增逻辑:**
- 新增 `refreshTick: number` prop
- 新增 effect:
  ```tsx
  useEffect(() => {
    if (refreshTick > 0) {
      reload();
    }
  }, [refreshTick]); // 故意不依赖 reload(reload 引用稳定,useCallback [])
  ```
- 复用既有 `useDevices().reload()`,**不改 hook**
**依赖:** 既有 `reload` from `useDevices`、`useEffect`

### ProjectsPage.tsx(修改)
**职责:** 将 `refreshTick` 作为 `refreshKey` 透传给所有 ProjectCard。
**新增逻辑:**
- 新增 `refreshTick: number` prop
- 每个 `<ProjectCard>` 传入 `refreshKey={refreshTick}`
**依赖:** 无新增

### ProjectCard.tsx(修改)
**职责:** 状态检测 effect 响应 `refreshKey` 变化,重新检测 MCP 状态。
**新增逻辑:**
- 新增 `refreshKey: number` prop
- 状态检测 effect(`ProjectCard.tsx:125-147`)的依赖数组追加 `refreshKey`:
  ```tsx
  }, [item.path, toolkitPath, refreshKey]);
  ```
- effect 内部逻辑不变(空路径 idle → 非空 checking → 防抖 detectProjectStatus)
**依赖:** 无新增

## 模块交互

### 数据流(设备页刷新)
```
用户点击 Header 刷新按钮(devices tab)
  └─ Header.handleRefreshClick
       ├─ setIsRefreshing(true) ──> 图标开始旋转
       ├─ onRefresh() ──> App.handleRefresh
       │    ├─ setRefreshTick(t => t+1) ──> refreshTick 变化
       │    │    └─ ContentArea 透传 ──> DevicesPage.refreshTick 变化
       │    │         └─ DevicesPage useEffect 触发 ──> reload()
       │    │              └─ useDevices 内部 reloadCount++ ──> readDevices() 重读 YAML
       │    └─ (全局 MCP 重读仅在项目页有意义,设备页也调但不影响 UI——见技术决策 T3)
       └─ setTimeout 500ms ──> setIsRefreshing(false) ──> 图标停止旋转
```

### 数据流(项目页刷新)
```
用户点击 Header 刷新按钮(projects tab)
  └─ Header.handleRefreshClick
       ├─ setIsRefreshing(true)
       ├─ onRefresh() ──> App.handleRefresh
       │    ├─ setRefreshTick(t => t+1)
       │    │    └─ ContentArea ──> ProjectsPage.refreshTick 变化
       │    │         └─ 透传 refreshKey={refreshTick} 给每个 ProjectCard
       │    │              └─ ProjectCard 状态检测 effect 重跑
       │    │                   └─ detectProjectStatus(path, toolkitPath) ──> 徽章更新
       │    └─ detectGlobalMcp() ──> setGlobalMcpChecked(最新) ──> 开关视觉更新 + 卡片按钮联动
       └─ setTimeout 500ms ──> setIsRefreshing(false)
```

### 关键时序:refreshTick 与首次挂载
```
应用启动
  └─ App 挂载,refreshTick = 0
       └─ DevicesPage 挂载,useEffect 检查 refreshTick > 0 → false → 不触发 reload
            └─ useDevices 自身的挂载 effect 正常读取一次(既有逻辑,不受影响)
  └─ 用户点击刷新
       └─ refreshTick = 1 ──> DevicesPage useEffect 检查 1 > 0 → true → reload()
```

## 文件组织

```
src/
├── App.tsx                           — 修改:持有 refreshTick + handleRefresh + 透传
├── components/
│   ├── Header.tsx                    — 修改:渲染刷新按钮 + 旋转动画
│   ├── ContentArea.tsx               — 修改:透传 refreshTick
│   └── ProjectCard.tsx               — 修改:状态检测 effect 依赖新增 refreshKey
└── pages/
    ├── DevicesPage.tsx               — 修改:监听 refreshTick 触发 reload
    └── ProjectsPage.tsx              — 修改:透传 refreshKey 给 ProjectCard
```

> 全部为修改既有文件,无新建文件,无新增依赖。

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 刷新信号传递方式 | `refreshTick: number` 计数器,复用现有「信号透传」模式(createOpen / projectCreateOpen) | 与项目既有架构一致,从 App → ContentArea → Page 的透传链已验证可用;计数器简单可靠,无需引入事件总线或 context |
| 单一计数器 vs 按页签分计数器 | 单一 `refreshTick` | ContentArea 的 `key={activeTab}` 保证任何时刻只有一个页签挂载,切换时旧页面卸载、新页面挂载自带初始加载,无需区分目标;单一计数器最简 |
| 设备页刷新实现 | 复用 `useDevices.reload()`,不改 hook | `reload()` 已是「磁盘 → UI」的现成通道(reloadCount 驱动 effect 重读),仅需在 `refreshTick` 变化时调用一次,零重复逻辑 |
| 项目页 MCP 状态刷新实现 | 给 ProjectCard 加 `refreshKey`,加入状态检测 effect 依赖数组 | ProjectCard 的状态检测依赖 `[item.path, toolkitPath]`,外部改 `.mcp.json` 但路径不变时不触发;加 `refreshKey` 让 effect 在刷新信号变化时重跑,是最小侵入方案 |
| 旋转动画归属层 | Header 内部 `isRefreshing` 局部状态,固定 500ms `setTimeout` | 动画纯视觉反馈,与实际数据加载解耦;数据读取通常 <100ms,500ms 给足视觉感知;放在 Header 避免跨层状态传递 |
| 全局 MCP 刷新归属 | App.handleRefresh 内调 `detectGlobalMcp()` | 全局 MCP 状态(`globalMcpChecked`)在 App 层持有(`App.tsx:65`),刷新时重读最直接;与 refreshTick 递增同在一个 handler 内,一次点击同时刷新页面数据 + 全局开关 |
| refreshTick 初始值与首次加载保护 | 初始 0,effect 内 `if (refreshTick > 0)` 才触发 | 各页面已有挂载时的初始加载逻辑,若 refreshTick=0 也触发会导致重复加载(设备页会读两次 YAML);加判断确保首次挂载不额外触发 |
| refreshTick 是否纳入 effect 依赖的 eslint 规则 | `useEffect(..., [refreshTick])`,故意排除 `reload` | `reload` 来自 `useCallback([])`(`useDevices.ts:56`),引用稳定永不变化,纳入依赖无意义且触发 eslint 警告;刻意排除并加注释说明 |
| 设备页刷新时是否也重读全局 MCP | handleRefresh 无条件调 detectGlobalMcp | 设备页不显示全局开关,重读结果不影响设备页 UI(仅更新 App 层 state,无视觉变化);为保持 handleRefresh 逻辑统一(不按 tab 分流),无条件调用,开销极小(一次文件读) |

## 编码规范

**编程语言:** TypeScript(React 19 + Tauri 2)

**适用的语言规范技能:** ts-lang-spec

**文件编码规则(语言规范技能优先,以下为兜底):**
- **新建文件**:UTF-8 无 BOM、LF 换行。语言规范技能另有要求时从其规定。
- **修改已有文件**(硬规则,不得覆盖):必须保持原文件编码与换行符不变。

开发阶段编写代码时,必须遵循 ts-lang-spec 中定义的编码风格、命名约定、注释规范等要求。开发执行者应在开始编码前自动调用该技能,并严格遵守上述文件编码规则。每个 `.ts/.tsx` 文件顶部保持项目既有的文件头注释格式(Copyright / File name / Author / Date / Description),本次修改的文件需更新 Description 追加「手动刷新」相关说明。
