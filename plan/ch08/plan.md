# 全局 MCP 配置开关 Plan

## 架构概览

在 ch07 项目级 MCP 配置的基础上，新增「全局 MCP 开关」能力。沿用项目既有四层架构，改动集中在三个点：

1. **基础组件层**（`components/ui/switch.tsx`）——从 cc-switch 移植 Radix Switch，补齐 UI 原子组件
2. **纯逻辑层**（`lib/globalMcp.ts`）——`~/.claude.json` 的检测/写入/移除（字段级合并）
3. **视图层联动**（Header 开关 + 确认对话框 + ProjectsPage 状态透传 + ProjectCard 配置按钮禁用）

开关状态**唯一来源是 `~/.claude.json`**，不在应用 settings.json 持久化，避免双源不一致。状态在 ProjectsPage 加载时检测一次，操作后刷新。

## 核心数据结构

### GlobalMcpStatus（判别联合，无需新建 types 文件，内联于 lib）

```ts
/** 全局 MCP 配置状态（判别联合） */
export type GlobalMcpStatus =
  | { kind: "unknown" }    // 未检测 / 加载中 / 非 Tauri 环境
  | { kind: "enabled" }    // ~/.claude.json 含 mcpServers.embedded-board
  | { kind: "disabled" };  // 不含
```

> 状态语义刻意简单：只有「含/不含 embedded-board」两态加一个 unknown 过渡态。command 值是否正确不在开关层校验——开关只管「有没有」，用户开启时无论原 command 对错都会用正确值覆盖写入。

## 核心接口

### 全局配置纯逻辑层（`lib/globalMcp.ts`）

```ts
/** ~/.claude.json 的运行时模型（仅关注 mcpServers，其余字段透传） */
interface ClaudeGlobalConfig {
  mcpServers?: Record<string, { command?: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

/** 获取 ~/.claude.json 的绝对路径（homeDir + .claude.json） */
export async function getClaudeGlobalConfigPath(): Promise<string>;

/** 检测全局 MCP 是否已启用（mcpServers 含 embedded-board） */
export async function detectGlobalMcp(): Promise<GlobalMcpStatus>;

/** 启用全局 MCP：写入 mcpServers.embedded-board.command（字段级合并） */
export async function enableGlobalMcp(toolkitPath: string): Promise<void>;

/** 禁用全局 MCP：移除 mcpServers.embedded-board（仅删该 key） */
export async function disableGlobalMcp(): Promise<void>;
```

### 复用既有接口

- `buildMcpCommand(toolkitPath)` from `lib/projects.ts`——command 正斜杠归一拼接，全局与项目级共用同一拼接逻辑，确保 command 值一致

## 模块设计

### components/ui/switch.tsx（新建）
**职责：** 从 cc-switch 移植 Radix Switch 基础组件（`@radix-ui/react-switch`），绿色开/灰色关的经典拨动开关。
**对外接口：** `Switch`（forwardRef，props 透传 Radix SwitchPrimitives.Root）。
**依赖：** `@radix-ui/react-switch`（新增依赖）、`lib/utils` 的 `cn`。

### lib/globalMcp.ts（新建）
**职责：** `~/.claude.json` 的读写——检测 embedded-board 存在性、写入（字段级合并 command）、移除（仅删 embedded-board key）。所有 IO 用 `@tauri-apps/plugin-fs`，异常向上抛由调用方处理。
**对外接口：** `getClaudeGlobalConfigPath`、`detectGlobalMcp`、`enableGlobalMcp`、`disableGlobalMcp`、`GlobalMcpStatus`、`ClaudeGlobalConfig`。
**依赖：** `@tauri-apps/api/path`（homeDir、join）、`@tauri-apps/plugin-fs`（exists、readTextFile、writeTextFile）、`config/projects`（MCP_SERVER_NAME）、`lib/projects`（buildMcpCommand）。
**内部辅助：** `readGlobalConfig()`——读 `~/.claude.json`，文件不存在/解析失败返回空对象 `{}`（spec N2 降级）。

### components/GlobalMcpSwitch.tsx（新建）
**职责：** Header 中的全局 MCP 开关组件。
- 受控开关：`checked`（boolean）+ `onCheckedChange` 回调
- 内部不直接操作文件——状态与文件操作由父组件（ProjectsPage）管理，本组件只负责视觉与点击分发
- 点击触发 `onCheckedChange` 后，父组件弹确认框；确认框关闭前的「回弹」由 Radix Switch 的**受控模式**自然实现（checked 未变则视觉不变）
**对外接口：**
```ts
interface GlobalMcpSwitchProps {
  /** 当前是否启用（受控） */
  checked: boolean;
  /** 开关切换回调（父组件据此弹确认框并执行文件操作） */
  onCheckedChange: (checked: boolean) => void;
}
```
**依赖：** `components/ui/switch`。

### components/GlobalMcpConfirmDialog.tsx（新建）
**职责：** 全局 MCP 开关的确认对话框，开启/关闭两种场景复用同一组件，按 `action` 区分文案与按钮。
- `action: "enable"`：告知「将禁用项目级配置按钮」，确认按钮文案「启用」
- `action: "disable"`：告知「将恢复项目级配置能力」，确认按钮文案「关闭」
- 确认后调 `onConfirm`，取消调 `onClose`
**对外接口：**
```ts
interface GlobalMcpConfirmDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 操作类型（决定文案） */
  action: "enable" | "disable";
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消/关闭回调 */
  onClose: () => void;
}
```
**依赖：** `components/ui/dialog`、`components/ui/button`。

### components/Header.tsx（修改）
**职责：** 项目页分支新增全局开关渲染。`activeTab === "projects"` 时，在「新增项目」按钮**左侧**渲染 `<GlobalMcpSwitch>`（受控，props 由 ProjectsPage 经 ContentArea/App 透传）。
**对外接口：** 新增 `globalMcpChecked: boolean`、`onGlobalMcpToggle: (checked: boolean) => void`。

### components/ProjectCard.tsx（修改）
**职责：** 「配置」按钮新增 `globalMcpEnabled` 联动禁用。新增 prop `globalEnabled: boolean`，为 true 时配置按钮强制 `disabled` 且无 hover 类，优先级高于项目自身状态（即项目已 OK 也禁用）。
**对外接口：** `ProjectCardProps` 新增 `globalEnabled: boolean`。

### pages/ProjectsPage.tsx（修改）
**职责：** 全局开关的状态管理与文件操作编排。
- 挂载时 `detectGlobalMcp()` 得初始状态 → `globalChecked`
- `handleGlobalMcpToggle(checked)`：设 `pendingAction`（"enable"/"disable"）并打开确认框
- `handleConfirm`：按 pendingAction 调 `enableGlobalMcp`/`disableGlobalMcp`，成功后 `detectGlobalMcp` 刷新 + toast，失败 toast error；关闭确认框
- `handleCancel`：关闭确认框（Radix Switch 受控，checked 未变自然回弹）
- 透传 `globalEnabled={globalChecked}` 给每张 ProjectCard
- toolkit 引导态时不渲染开关相关逻辑（开关本就在 Header，引导态时 Header 的项目页分支也不渲染——见 Header 改造说明）

### 透传链（ContentArea.tsx + App.tsx，修改）
**ContentArea：** `ContentAreaProps` 新增 `globalMcpChecked`、`onGlobalMcpToggle`，透传给 ProjectsPage；ProjectsPage 反向上报开关状态与切换事件。**这里有个设计选择**（见技术决策 T1）。
**App：** 持有 `globalMcpChecked` state + `handleGlobalMcpToggle`，透传给 Header 与 ContentArea。

## 模块交互

### 数据流（初始检测）
```
App（activeTab="projects"）
  └─ ProjectsPage 挂载
       └─ detectGlobalMcp() ──> setGlobalChecked(true/false)
            └─ 上报到 App（setGlobalMcpChecked）──> Header 开关视觉
            └─ 透传 globalChecked 给 ProjectCard ──> 配置按钮联动
```

### 数据流（开启全局配置）
```
Header GlobalMcpSwitch 拨向开 ──> onCheckedChange(true)
  └─ App.handleGlobalMcpToggle(true) ──> 透传到 ProjectsPage
       └─ setPendingAction("enable") + 打开确认框
       └─ 确认框「启用」──> enableGlobalMcp(toolkitPath)
            ├─ 成功 ──> detectGlobalMcp 刷新 ──> setGlobalChecked(true)
            │           ──> 上报 App ──> 开关变绿 + 项目配置按钮全禁用 + toast
            └─ 失败 ──> toast error（开关状态不变，回弹）
       └─ 确认框「取消」──> 关闭对话框（开关受控回弹为关）
```

### 数据流（关闭全局配置）
```
Header GlobalMcpSwitch 拨向关 ──> onCheckedChange(false)
  └─ ... 同上，action="disable"，调 disableGlobalMcp
       └─ 移除 mcpServers.embedded-board ──> 刷新 ──> 开关变灰 + 项目配置恢复
```

### enableGlobalMcp / disableGlobalMcp 内部（字段级合并）
```
enableGlobalMcp(toolkitPath):
  └─ readGlobalConfig() ──> curr（不存在/损坏按 {}）
       └─ curr.mcpServers ??= {}
       └─ curr.mcpServers["embedded-board"] = { command: buildMcpCommand(toolkitPath) }
       └─ writeTextFile(~/.claude.json, JSON.stringify(curr, null, 2))

disableGlobalMcp():
  └─ readGlobalConfig() ──> curr
       └─ if curr.mcpServers?.["embedded-board"] ──> delete curr.mcpServers["embedded-board"]
       └─ writeTextFile(~/.claude.json, JSON.stringify(curr, null, 2))
```

## 文件组织

```
src/
├── components/
│   ├── ui/
│   │   └── switch.tsx                — 新建：Radix Switch 基础组件（移植自 cc-switch）
│   ├── GlobalMcpSwitch.tsx           — 新建：Header 全局 MCP 开关（受控）
│   ├── GlobalMcpConfirmDialog.tsx    — 新建：开启/关闭确认对话框（复用）
│   ├── Header.tsx                    — 修改：项目页分支新增开关渲染
│   └── ProjectCard.tsx               — 修改：配置按钮新增 globalEnabled 联动禁用
├── lib/
│   └── globalMcp.ts                  — 新建：~/.claude.json 检测/写入/移除
├── pages/
│   └── ProjectsPage.tsx              — 修改：全局开关状态管理 + 文件操作编排
├── components/
│   ├── ContentArea.tsx               — 修改：透传 globalMcpChecked / onGlobalMcpToggle
│   └── (App.tsx 见下)
└── App.tsx                           — 修改：持有 globalMcpChecked state + 透传
```

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 开关状态来源 | 唯一来源 `~/.claude.json`，不持久化到应用 settings.json | 避免双源不一致；`~/.claude.json` 是 Claude Code 的真实配置，应用内状态必须与之同步，否则开关显示与实际生效不符 |
| 开关组件选型 | Radix Switch（移植 cc-switch 的 switch.tsx） | 用户明确要求参考 cc-switch 的开关样式；Radix 提供受控模式天然支持「取消回弹」；cc-switch 已验证可用 |
| 状态提升层级 | globalMcpChecked 提升到 App | Header 开关在 App 层渲染，状态需在 App 持有；ProjectsPage 通过回调上报检测结果，App 透传 checked 给 Header |
| 检测时机 | ProjectsPage 挂载时检测一次 + 每次操作后刷新 | 开关状态本质是文件状态，挂载时读一次保证初始正确；操作后立即刷新保证 UI 与文件同步；不做轮询（YAGNI） |
| 开关层是否校验 command 正确性 | 不校验，开启时无条件用 buildMcpCommand 覆盖 | 开关语义是「有没有 embedded-board」，不是「command 对不对」；用户开启即表达意图，用正确值覆盖最省心；避免开关层引入复杂的 command 比对逻辑 |
| 确认对话框复用 | 开启/关闭共用一个组件，按 action 区分文案 | 两种场景结构一致（文案 + 确认/取消），复用减少重复；action 字段驱动文案与按钮文案 |
| 开关受控回弹 | Radix Switch 受控模式（checked 由父组件控制） | 用户拨动触发 onCheckedChange，但 checked 不立即改变；父组件弹确认框，取消时 checked 未变 → 视觉自然回弹；无需手动回滚状态 |
| 项目配置按钮禁用优先级 | globalEnabled 为 true 时强制禁用，优先级高于项目自身状态 | 全局启用时项目级配置冗余，无论项目自身 OK/未配置都应禁用；避免用户在全局模式下误操作项目配置 |
| `~/.claude.json` 路径获取 | `homeDir()` + `join(home, ".claude.json")` | Tauri 官方 API，跨平台；cc-switch 已验证此用法 |
| JSON 序列化格式 | `JSON.stringify(curr, null, 2)`（2 空格缩进） | 与 ch07 项目级配置的写入格式一致；人类可读，便于用户手动检查 |

## 编码规范

**编程语言：** TypeScript（React 19 + Tauri 2）

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（语言规范技能优先，以下为兜底）：**
- **新建文件**：UTF-8 无 BOM、LF 换行。语言规范技能另有要求时从其规定。
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变。

开发阶段编写代码时，必须遵循 ts-lang-spec 中定义的编码风格、命名约定、注释规范等要求。开发执行者应在开始编码前自动调用该技能，并严格遵守上述文件编码规则。每个 `.ts/.tsx` 文件顶部保持项目既有的文件头注释格式（Copyright / File name / Author / Date / Description）。
