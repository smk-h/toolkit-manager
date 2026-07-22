# 项目级 MCP 配置管理 Plan

## 架构概览

完全沿用项目既有四层架构（types → lib → hooks → components → pages），新增「项目」域与既有「设备」「目录」域平级。组件分层与状态上提模式照搬设备页。

共五个新增/改造组件区块：

1. **配置常量层**（`config/projects.ts`）——独立新键 `project-config`、固定 server 名 `embedded-board`、启动脚本 `remote-start-mcp.bat`、两个目标文件相对路径
2. **类型层**（`types/projects.ts`）——项目项运行时/持久化结构、配置状态判别联合
3. **纯逻辑层**（`lib/projects.ts`）——状态判定、路径拼接、文件读写（JSON 字段级合并，不破坏既有字段）
4. **状态层**（`hooks/useProjects.ts`）——列表状态 + 增删改 + 状态检测的统一封装
5. **视图层**（`pages/ProjectsPage.tsx` + `components/ProjectCard.tsx`）——卡片 UI + 引导态 + 新增入口（Header 改造 + App/ContentArea 透传）

## 核心数据结构

### ProjectItem（运行时，`types/projects.ts`）

```ts
/** 项目项（运行时，含前端字段） */
export interface ProjectItem {
  /** 前端唯一标识（crypto.randomUUID()，不入库） */
  id: string;
  /** 项目目录路径（用户输入或选择，空字符串表示新增未填写） */
  path: string;
}
```

### StoredProjectItem（持久化，`types/projects.ts`）

```ts
/** 项目项持久化结构（入库只存路径） */
export interface StoredProjectItem {
  /** 项目目录路径 */
  path: string;
}
```

入库结构刻意只保留 `path`——运行时 id 仅 React key 用，不落盘；当前需求无需为项目附带其他元数据。

### ProjectConfigStatus（判别联合，`types/projects.ts`）

```ts
/**
 * 项目配置状态（四态判别联合）
 *
 * 用 kind 字段穷尽分支，UI 按此分流徽章样式与配置按钮可用性。
 * idle 与 toolkit-missing 区分两种「不渲染徽章」的情况：
 * - idle：空路径/未填写，连检测都不触发
 * - toolkit-missing：toolkit 路径未配置或不存在（属 F5 引导态，不是卡片徽章该显示的）
 */
export type ProjectConfigStatus =
  | { kind: "idle" }                  // 空路径，未触发检测
  | { kind: "checking" }              // 检测进行中
  | { kind: "ok" }                    // 两文件齐备 + 字段正确 + toolkit 正常
  | { kind: "not-configured" }        // 文件缺失或字段缺失（toolkit 正常）
  | { kind: "config-error" };         // toolkit 路径不存在或启动脚本不存在
```

> 说明：`toolkit-missing` 不放入此联合——toolkit 路径异常时项目页整页进入引导态（F5），卡片层只面对「toolkit 正常」前提下的三态徽章（ok / not-configured / config-error），避免卡片状态机承担页面级职责。

## 核心接口

### 状态判定纯函数（`lib/projects.ts`）

```ts
/**
 * 判定单个项目的配置状态
 *
 * 检测顺序：toolkit 健康度 → 文件存在性 → 字段正确性。
 * 任一层级失败立即返回对应状态，避免无谓的后续检测。
 *
 * @param projectPath - 项目目录路径
 * @param toolkitPath - embedded-mcp-toolkit 根路径（来自 directory-config 预置项）
 * @returns 配置状态
 */
export async function detectProjectStatus(
  projectPath: string,
  toolkitPath: string,
): Promise<ProjectConfigStatus>;
```

### 一键配置纯函数（`lib/projects.ts`）

```ts
/**
 * 为项目写入/修正 MCP 配置（字段级合并，不破坏既有字段）
 *
 * 处理顺序：建目录 → 写/改 .mcp.json 的 command → 写/改
 * .claude/settings.local.json 的 enabledMcpjsonServers。
 * 每个文件先读后改后写：读取失败按空对象处理，写入失败抛错由调用方处理。
 *
 * @param projectPath - 项目目录路径（不存在则先创建）
 * @param toolkitPath - toolkit 根路径（用于拼接 command）
 * @throws 文件系统错误（权限拒绝、磁盘满等）由调用方 try/catch
 */
export async function applyProjectConfig(
  projectPath: string,
  toolkitPath: string,
): Promise<void>;
```

### 持久化读写（`lib/store.ts` 扩展）

```ts
/** 读取项目列表（独立键 project-config；非 Tauri 环境或异常返回 []） */
export async function readProjectConfig(): Promise<readonly StoredProjectItem[]>;

/** 写入项目列表（立即落盘；非 Tauri 环境直接返回） */
export async function writeProjectConfig(
  items: readonly StoredProjectItem[],
): Promise<void>;
```

### 列表状态 hook（`hooks/useProjects.ts`）

```ts
export interface UseProjectsResult {
  /** 项目列表（含前端 id） */
  items: readonly ProjectItem[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 新增空项目项（追加末尾，立即落盘） */
  addItem: () => void;
  /** 更新指定 id 的项目路径（立即落盘） */
  updatePath: (id: string, path: string) => void;
  /** 删除指定 id 的项目项（立即落盘） */
  removeItem: (id: string) => void;
}
```

> `useProjects` 只管列表增删改与持久化，**不管状态检测**。状态检测由 `ProjectCard` 内部按 path 防抖触发（同 `DirectoryItemRow` 用 `useDebouncedCheck` 的模式），避免列表层为每张卡片维护一份异步状态。

## 模块设计

### config/projects.ts
**职责：** 项目域静态常量。
**对外接口：** `PROJECT_CONFIG_KEY`、`MCP_SERVER_NAME`、`MCP_STARTUP_SCRIPT`、`TOOLKIT_PRESET_NAME`、`CLAUDE_DIR_NAME`、`CLAUDE_SETTINGS_FILENAME`、`MCP_CONFIG_FILENAME`、`TOOLKIT_PRESET_NAME`。
**依赖：** 无。

### types/projects.ts
**职责：** 项目域类型定义。
**对外接口：** `ProjectItem`、`StoredProjectItem`、`ProjectConfigStatus`。
**依赖：** 无。

### lib/projects.ts
**职责：** 项目配置的纯逻辑层——状态判定、command 路径拼接、两文件的字段级读写合并。所有文件 IO 用 `@tauri-apps/plugin-fs`，异常向上抛由调用方处理。
**对外接口：** `detectProjectStatus`、`applyProjectConfig`、`buildMcpCommand`（纯拼接）、`buildDefaultMcpJson`（构建全新 .mcp.json 内容）、`buildDefaultClaudeSettings`（构建全新 settings.local.json 内容）。
**依赖：** `@tauri-apps/plugin-fs`、`config/projects`、`config/settings`、`types/projects`。

### lib/store.ts（修改）
**职责：** 新增 `readProjectConfig` / `writeProjectConfig`，复用既有 `loadStore` / `isTauriEnv`，键名用 `PROJECT_CONFIG_KEY`。结构与 `readDirectoryConfig` / `writeDirectoryConfig` 同构（含格式校验容错，非 `{path:string}[]` 视为空）。
**依赖：** 新增 `config/projects` 的 `PROJECT_CONFIG_KEY`、`types/projects` 的 `StoredProjectItem`。

### hooks/useProjects.ts
**职责：** 项目列表状态 + 持久化。挂载时 `readProjectConfig` → 注入前端 id；增删改立即更新内存 + 异步落盘。结构与 `useDirectoryConfig` 同构，但无预置项概念、无 name 字段。
**对外接口：** `UseProjectsResult`。
**依赖：** `lib/store`、`types/projects`。

### components/ProjectCard.tsx
**职责：** 单张项目卡片 UI。
- 左侧路径输入框（受控）
- 「打开」按钮（调系统目录选择器，参考 SettingsPage 的 `open({directory:true})`）
- 「配置」按钮（状态非 OK 时可点，调 `applyProjectConfig`，成功后 toast + 刷新本卡片状态）
- 「删除」按钮（调 `onRemove` 移除卡片记录与 settings.json 记录，不触碰项目目录下的两个配置文件）
- 状态徽章（按 `ProjectConfigStatus.kind` 渲染颜色与文案）
- 警告提示（重复路径 / 路径不存在，由父组件传入校验结果）
**状态管理：** 卡片内部持 `status: ProjectConfigStatus`，path 变化时防抖触发 `detectProjectStatus`（参考 `useDebouncedCheck` 的防抖模式，但检测逻辑更复杂——直接在卡片内用 useEffect+setTimeout，或抽一个 `useProjectStatus` 小 hook）。
**对外接口：**
```ts
interface ProjectCardProps {
  item: ProjectItem;
  toolkitPath: string;                 // 由页面从 directory-config 预置项取
  isDuplicate: boolean;                // 路径是否与其它项目重复
  exists: boolean | null;              // 路径是否存在（null 表示检测中或 idle）
  onPathChange: (id: string, path: string) => void;
  onPickDirectory: (id: string) => void;
  onRemove: (id: string) => void;
  onConfigured: (id: string) => void;  // 配置成功回调（触发状态刷新）
}
```
**依赖：** `lib/projects`、`types/projects`、`hooks/useToast`、`components/ui/*`。

### pages/ProjectsPage.tsx（重写，替换占位）
**职责：** 项目页容器。
- 加载 directory-config 取 toolkit 预置项路径；toolkit 为空/不存在 → 引导卡片（复用设备页 `GuideCard` 模式，提供「去设置」按钮）
- toolkit 正常 → 渲染项目卡片列表
- 持有 `createOpen` 受控开关（Header「新增项目」触发，透传链同设备页）
- 为每张卡片计算 `isDuplicate`（遍历 items 比对 path）与 `exists`（每项 path 防抖 exists 检测，可用 `useDebouncedCheck`）
**对外接口：**
```ts
interface ProjectsPageProps {
  onNavigateSettings: () => void;
  createOpen: boolean;
  onCreateClose: () => void;
}
```
**依赖：** `hooks/useProjects`、`hooks/useDirectoryConfig`、`components/ProjectCard`、`config/devices`（复用 `PRESET_DEVICE_DIR_NAME` 作为 toolkit 预置项名）、`config/projects`。

### components/Header.tsx（修改）
**职责：** 新增「新增项目」按钮分支。`activeTab === "projects"` 时渲染按钮，回调 `onAddProject`，风格与「新增设备」完全一致（ghost + 橙色悬浮）。
**对外接口：** 新增 `onAddProject: () => void`。

### components/ContentArea.tsx（修改）
**职责：** 透传项目页所需 props。`renderPage` 的 `projects` 分支改为渲染 `<ProjectsPage onNavigateSettings={() => onSwitch("settings")} createOpen={projectCreateOpen} onCreateClose={onProjectCreateClose} />`。`ContentAreaProps` 新增 `projectCreateOpen` / `onProjectCreateClose`。

### App.tsx（修改）
**职责：** 新增 `projectCreateOpen` state，透传给 Header 与 ContentArea（与设备页 `createOpen` 同构）。

## 模块交互

### 数据流（加载）
```
App（activeTab="projects"）
  └─ ContentArea ──> ProjectsPage
       ├─ useDirectoryConfig() ──> 取 toolkit 预置项 path
       │    └─ 为空/不存在 ──> GuideCard「去设置」
       └─ useProjects() ──> items 列表
            └─ items.map ──> ProjectCard（每张独立检测状态）
```

### 数据流（新增项目）
```
Header「新增项目」点击 ──> App setProjectCreateOpen(true)
  ──> ContentArea 透传 ──> ProjectsPage createOpen=true
       └─ useProjects().addItem()（追加空项，立即落盘）
       └─ onCreateClose() 关闭标志
```
> 与设备页不同：项目卡片无两阶段对话框（无需输入名称/配置），Header 点击直接 `addItem` 即可——项目卡片本身就是路径输入框。`createOpen` 仅作为「触发一次 addItem」的信号。

### 数据流（一键配置）
```
ProjectCard「配置」点击
  └─ applyProjectConfig(projectPath, toolkitPath)
       ├─ 项目目录不存在 ──> mkdir（recursive）
       ├─ 读 .mcp.json（失败按空）──> 合并 mcpServers.embedded-board.command ──> 写回
       └─ 读 .claude/settings.local.json（失败按空）──> 合并 enabledMcpjsonServers（去重含 embedded-board）──> 写回
  └─ 成功 ──> show toast + 重新 detectProjectStatus 刷新徽章
  └─ 失败 ──> show toast error（不刷新徽章）
```

### 数据流（状态检测，卡片内部）
```
ProjectCard path 变化
  └─ 防抖 400ms ──> detectProjectStatus(path, toolkitPath)
       ├─ toolkitPath 为空 ──> idle（页面级引导态已拦截，不应到这）
       ├─ toolkit 路径 exists? 否 ──> config-error
       ├─ remote-start-mcp.bat exists? 否 ──> config-error
       ├─ .mcp.json 存在 且 mcpServers.embedded-board.command 正确? 否 ──> not-configured
       ├─ .claude/settings.local.json 存在 且 enabledMcpjsonServers 含 embedded-board? 否 ──> not-configured
       └─ 全满足 ──> ok
```

### 数据流（删除项目）
```
ProjectCard「删除」点击 ──> onRemove(item.id)
  └─ useProjects().removeItem(id)
       ├─ 内存态：items 过滤掉该 id
       └─ 持久化：writeProjectConfig（仅写剩余项的 path）
注：不调用任何文件删除/修改 API，项目目录下的 .mcp.json 与 .claude/settings.local.json 原样保留
```


## 文件组织

```
src/
├── config/
│   └── projects.ts                  — 新建：项目域常量（键名、server 名、脚本名、文件名）
├── types/
│   └── projects.ts                  — 新建：ProjectItem / StoredProjectItem / ProjectConfigStatus
├── lib/
│   ├── projects.ts                  — 新建：状态判定、路径拼接、字段级读写合并
│   └── store.ts                     — 修改：新增 readProjectConfig / writeProjectConfig
├── hooks/
│   └── useProjects.ts               — 新建：项目列表状态 + 持久化
├── components/
│   ├── ProjectCard.tsx              — 新建：单张项目卡片（输入+打开+配置+徽章+警告）
│   ├── Header.tsx                   — 修改：新增「新增项目」按钮分支
│   └── ContentArea.tsx              — 修改：透传 projectCreateOpen / onProjectCreateClose
├── pages/
│   └── ProjectsPage.tsx             — 重写：替换占位，实现完整项目页
└── App.tsx                          — 修改：新增 projectCreateOpen state + 透传
```

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 项目列表存储键 | 独立新键 `project-config`，与 `directory-config` 平级 | 用户明确要求不嵌套进 directory-config；平级键职责清晰，读写互不干扰 |
| MCP server 名 | 固定常量 `embedded-board` | 澄清阶段确认；与 embedded-mcp-toolkit 工具包一一对应，无需用户输入 |
| 启动脚本名 | 固定常量 `remote-start-mcp.bat` | 澄清阶段确认；脚本名写死，command 由 `${toolkit}/remote-start-mcp.bat` 拼接 |
| 状态检测归属 | 卡片内部（每张卡片独立防抖检测） | 复用 `useDebouncedCheck` 模式；列表层不为每卡片维护异步状态，避免 N 个并发 IO 状态涌入列表 hook |
| toolkit 异常的处理 | 页面级引导态拦截（F5），不进入卡片状态机 | 卡片状态机只面对 toolkit 正常前提下的三态，职责单一；避免 `toolkit-missing` 与徽章三态混淆 |
| JSON 字段合并策略 | 读-改-写（先 `readTextFile` 再 `JSON.parse`，失败按空对象；合并后 `JSON.stringify` 写回） | spec F4 要求「不影响其他字段」；设备页 YAML 用文本级替换是因 YAML 格式敏感，JSON 用 parse/stringify 更可靠且保留所有字段 |
| `.claude/settings.local.json` 的 enabledMcpjsonServers 合并 | 数组去重合并（保留既有项，追加 embedded-board） | spec F4「不影响其他字段」；去重避免重复写入 server 名 |
| command 路径「正确」的判定 | 与 `buildMcpCommand(toolkitPath)` 完全相等才算正确 | 简化判定逻辑；路径分隔符差异（`/` vs `\`）由「正确值」统一规范，不符即 not-configured，配置按钮会修正 |
| 新增项目入口交互 | Header 按钮直接 `addItem`，无对话框 | 项目卡片本身就是路径输入框，无需两阶段对话框；比设备页更轻量 |
| 重复路径 / 不存在路径 | 警告提示（warning 文案），不阻断，不改变徽章 | spec F7/F8 明确「警告」非「错误」；路径不存在时用户可能想通过配置按钮创建目录 |
| `command` 路径分隔符 | 统一用正斜杠 `/`（与 user.md 示例一致，跨平台） | user.md 示例为 `E:/AI/embedded-mcp-toolkit/remote-start-mcp.bat`；Windows 下 `/` 与 `\` 均可，统一用 `/` 避免 JSON 转义问题 |
| 状态检测防抖时长 | 400ms（与 `useDebouncedCheck` 默认一致） | 项目既有约定，保持一致 |

## 编码规范

**编程语言：** TypeScript（React 19 + Tauri 2）

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（语言规范技能优先，以下为兜底）：**
- **新建文件**：UTF-8 无 BOM、LF 换行。语言规范技能另有要求时从其规定。
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变。

开发阶段编写代码时，必须遵循 ts-lang-spec 中定义的编码风格、命名约定、注释规范等要求。开发执行者应在开始编码前自动调用该技能，并严格遵守上述文件编码规则。每个 `.ts/.tsx` 文件顶部保持项目既有的文件头注释格式（Copyright / File name / Author / Date / Description）。
