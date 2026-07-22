# 项目级 MCP 配置管理 Tasks

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/config/projects.ts` | 项目域常量（键名、server 名、脚本名、子目录与文件名） |
| 新建 | `src/types/projects.ts` | ProjectItem / StoredProjectItem / ProjectConfigStatus |
| 新建 | `src/lib/projects.ts` | 状态判定、command 拼接、两文件字段级读写合并 |
| 修改 | `src/lib/store.ts` | 新增 readProjectConfig / writeProjectConfig |
| 新建 | `src/hooks/useProjects.ts` | 项目列表状态 + 持久化 hook |
| 新建 | `src/components/ProjectCard.tsx` | 单张项目卡片（输入+打开+配置+徽章+警告） |
| 重写 | `src/pages/ProjectsPage.tsx` | 替换占位，实现完整项目页（列表+引导态） |
| 修改 | `src/components/Header.tsx` | 新增「新增项目」按钮分支 |
| 修改 | `src/components/ContentArea.tsx` | 透传 projectCreateOpen / onProjectCreateClose |
| 修改 | `src/App.tsx` | 新增 projectCreateOpen state + 透传 |

## T1: 项目域常量与类型

**文件：** `src/config/projects.ts`、`src/types/projects.ts`
**依赖：** 无
**步骤：**
1. 新建 `src/config/projects.ts`，定义常量并附 JSDoc：
   - `PROJECT_CONFIG_KEY = "project-config"`（settings.json 中独立键名）
   - `MCP_SERVER_NAME = "embedded-board"`（写入两文件的 server 标识）
   - `MCP_STARTUP_SCRIPT = "remote-start-mcp.bat"`（启动脚本文件名）
   - `TOOLKIT_PRESET_NAME = "embedded-mcp-toolkit"`（复用 directory-config 预置项名，与 `PRESET_DEVICE_DIR_NAME` 值一致但本域独立声明）
   - `CLAUDE_DIR_NAME = ".claude"`（项目下 claude 配置子目录）
   - `CLAUDE_SETTINGS_FILENAME = "settings.local.json"`（claude 配置文件名）
   - `MCP_CONFIG_FILENAME = ".mcp.json"`（mcp 配置文件名）
2. 新建 `src/types/projects.ts`，定义并附 JSDoc：
   - `ProjectItem`（id、path）
   - `StoredProjectItem`（path）
   - `ProjectConfigStatus`（判别联合：idle / checking / ok / not-configured / config-error）
3. 两文件顶部加项目标准文件头注释（Copyright / File name / Author / Date / Description）

**验证：** `pnpm build` 编译通过（类型合法、无语法错误）

## T2: 持久化读写扩展

**文件：** `src/lib/store.ts`
**依赖：** T1
**步骤：**
1. 在 `store.ts` 顶部 import 区新增：`import { PROJECT_CONFIG_KEY } from "@/config/projects"` 与 `import type { StoredProjectItem } from "@/types/projects"`
2. 新增格式校验函数 `isStoredProjectArray(value: unknown): value is Array<{ path?: unknown }>`（参考既有 `isStoredDirectoryArray` 写法，校验 `Array.isArray && every(item => typeof object && has path)`）
3. 新增 `readProjectConfig(): Promise<readonly StoredProjectItem[]>`：
   - 非 Tauri 环境返回 `[]`（复用既有 `isTauriEnv()`）
   - `store.get(PROJECT_CONFIG_KEY)`，null/undefined 返回 `[]`
   - 通过 `isStoredProjectArray` 校验后 `map(item => ({ path: typeof item.path === "string" ? item.path : "" }))`
   - 格式不符返回 `[]`；try/catch 失败 `console.warn` 返回 `[]`
4. 新增 `writeProjectConfig(items: readonly StoredProjectItem[]): Promise<void>`：
   - 非 Tauri 环境直接 return
   - `store.set(PROJECT_CONFIG_KEY, items.map(i => ({ path: i.path })))` + `store.save()`
   - try/catch 失败 `console.warn` 不抛错

**验证：** `pnpm build` 编译通过；函数签名与 plan.md 一致

## T3: 项目配置纯逻辑层

**文件：** `src/lib/projects.ts`
**依赖：** T1
**步骤：**
1. 新建 `src/lib/projects.ts`，顶部文件头注释
2. import：`@tauri-apps/plugin-fs` 的 `exists`、`readTextFile`、`writeTextFile`、`mkdir`；`@tauri-apps/api/path` 的 `join`；`config/projects` 的全部常量；`types/projects`
3. 定义纯拼接函数 `buildMcpCommand(toolkitPath: string): string`：
   - 去除 toolkitPath 尾部斜杠/反斜杠（`replace(/[\\/]+$/, "")`）
   - 返回 `${trimmed}/remote-start-mcp.bat`（用 `/` 分隔，与常量 `MCP_STARTUP_SCRIPT` 拼接）
4. 定义 `buildDefaultMcpJson(): { $schema: string; mcpServers: Record<string, { command: string }> }`（$schema 用 `"https://json.schemastore.org/claude-code-settings.json"`，mcpServers 先空对象，由调用方填 command）
5. 定义 `buildDefaultClaudeSettings(): { enabledMcpjsonServers: string[] }`（空数组，由调用方填 server 名）
6. 定义内部辅助 `readJsonFile<T>(filePath: string): Promise<T | null>`：
   - `exists(filePath)` 为 false 返回 null
   - `readTextFile` 失败（catch）返回 null
   - `JSON.parse` 失败（catch）返回 null
   - 成功返回解析对象
7. 定义 `detectProjectStatus(projectPath: string, toolkitPath: string): Promise<ProjectConfigStatus>`：
   - 两者任一 trim 为空返回 `{ kind: "idle" }`
   - `await exists(toolkitPath)` 为 false → `{ kind: "config-error" }`
   - `await exists(buildMcpCommand(toolkitPath))` 为 false → `{ kind: "config-error" }`（脚本不存在）
   - 读 `.mcp.json`：`join(projectPath, MCP_CONFIG_FILENAME)`，解析后检查 `obj.mcpServers?.[MCP_SERVER_NAME]?.command === buildMcpCommand(toolkitPath)`，不满足 → `{ kind: "not-configured" }`
   - 读 `.claude/settings.local.json`：`join(projectPath, CLAUDE_DIR_NAME, CLAUDE_SETTINGS_FILENAME)`，解析后检查 `Array.isArray(obj.enabledMcpjsonServers) && obj.enabledMcpjsonServers.includes(MCP_SERVER_NAME)`，不满足 → `{ kind: "not-configured" }`
   - 全满足 → `{ kind: "ok" }`
   - 整个函数 try/catch：异常 → `{ kind: "not-configured" }`（spec N3 降级）
8. 定义 `applyProjectConfig(projectPath: string, toolkitPath: string): Promise<void>`：
   - `if (!await exists(projectPath)) await mkdir(projectPath, { recursive: true })`
   - 处理 `.mcp.json`：`readJsonFile` 得 `curr`（null 则用 `buildDefaultMcpJson()`）；设置 `curr.mcpServers ??= {}`；`curr.mcpServers[MCP_SERVER_NAME] = { command: buildMcpCommand(toolkitPath) }`；`writeTextFile(mcpPath, JSON.stringify(curr, null, 2))`
   - 处理 `.claude` 子目录：`const claudeDir = join(projectPath, CLAUDE_DIR_NAME)`，`if (!await exists(claudeDir)) await mkdir(claudeDir, { recursive: true })`
   - 处理 `.claude/settings.local.json`：`readJsonFile` 得 `curr`（null 则用 `buildDefaultClaudeSettings()`）；设置 `curr.enabledMcpjsonServers ??= []`；若 `!includes(MCP_SERVER_NAME)` 则 `push`；`writeTextFile(settingsPath, JSON.stringify(curr, null, 2))`
   - 注意：本函数不 try/catch 吞错，IO 异常向上抛由调用方处理

**验证：** `pnpm build` 编译通过；所有函数纯逻辑可被 import；类型签名与 plan.md 一致

## T4: 项目列表状态 hook

**文件：** `src/hooks/useProjects.ts`
**依赖：** T1、T2
**步骤：**
1. 新建 `src/hooks/useProjects.ts`，顶部文件头注释
2. import：`useCallback/useEffect/useMemo/useState`；`readProjectConfig/writeProjectConfig` from `@/lib/store`；`ProjectItem` from `@/types/projects`
3. 定义 `genId()`（参考 `useDirectoryConfig` 的写法：`crypto.randomUUID()` + try/catch 降级）
4. 定义 `UseProjectsResult` 接口（items、isLoading、addItem、updatePath、removeItem）
5. 实现 `useProjects()`：
   - `useState<ProjectItem[]>([])`、`useState<boolean>(true)`
   - 挂载 effect：`readProjectConfig()` → `map(i => ({ id: genId(), path: i.path }))` → `setItems` + `setIsLoading(false)`；cancelled 标志防卸载后 setState
   - `addItem`：`setItems(prev => { const next = [...prev, { id: genId(), path: "" }]; void writeProjectConfig(next.map(i => ({ path: i.path }))); return next })`
   - `updatePath`：`setItems(prev => { const next = prev.map(i => i.id === id ? { ...i, path } : i); void writeProjectConfig(next.map(i => ({ path: i.path }))); return next })`
   - `removeItem`：`setItems(prev => { const next = prev.filter(i => i.id !== id); void writeProjectConfig(next.map(i => ({ path: i.path }))); return next })`
   - `useMemo` 稳定返回引用（依赖 items/isLoading 及各 mutator）

**验证：** `pnpm build` 编译通过；hook 签名与 plan.md `UseProjectsResult` 一致

## T5: 项目卡片组件

**文件：** `src/components/ProjectCard.tsx`
**依赖：** T1、T3
**步骤：**
1. 新建 `src/components/ProjectCard.tsx`，顶部文件头注释
2. import：`useEffect/useRef/useState`；`lucide-react` 的 `FolderOpen`、`Settings2`（配置图标）、`Trash2`；`@/components/ui/input`、`@/components/ui/button`；`@/lib/projects` 的 `detectProjectStatus`、`applyProjectConfig`；`@/hooks/useToast`；`@/types/projects` 的 `ProjectItem`、`ProjectConfigStatus`
3. 定义 `ProjectCardProps`（item、toolkitPath、isDuplicate、exists、onPathChange、onPickDirectory、onRemove、onConfigured）
4. 实现 `ProjectCard`：
   - 内部 `useState<ProjectConfigStatus>({ kind: "idle" })`
   - 防抖检测 effect：依赖 `[item.path, toolkitPath]`；path trim 为空 → `setIdle` 直接返回；否则 setTimeout 400ms 后 `detectProjectStatus`（try/catch 降级为 not-configured），组件卸载/依赖变更清 timer
   - `handleConfig` async：`try { await applyProjectConfig(item.path, toolkitPath); show("配置已写入", "success"); const s = await detectProjectStatus(item.path, toolkitPath); setStatus(s); onConfigured(item.id) } catch { show("配置失败", "error") }`
   - 渲染布局（参考 `DirectoryItemRow` 的双行结构）：
     - 第一行：路径输入框（flex-1，受控 value=item.path，onChange 调 onPathChange）+ 右侧状态徽章槽位（定宽）
     - 第二行：路径输入框 + 按钮组（打开 + 配置 + 删除，三按钮定宽槽位）
     - 状态徽章渲染（按 `status.kind`）：
       - `idle` / `checking`：不渲染徽章（或 checking 显示灰色小字「检测中」）
       - `ok`：绿色徽章「OK」
       - `not-configured`：橙色徽章「未配置」
       - `config-error`：红色徽章「配置错误」
     - 「配置」按钮：`status.kind === "ok"` 时 `disabled` 且无 hover 类；其余状态可点 + `hover:bg-orange-500 hover:text-white`
     - 「打开」按钮风格同 `DirectoryItemRow`（outline + 橙色悬浮）
     - 「删除」按钮（Trash2 图标，ghost + 橙色悬浮），点击仅调 `onRemove(item.id)`，移除卡片与 settings.json 中 project-config 的记录；不删除/修改项目目录下的 .mcp.json 与 .claude/settings.local.json
     - 警告提示区（输入框下方）：`isDuplicate` 为 true 显示红字「路径与已有项目重复」；`exists === false` 显示红字「路径不存在」（参考 `DirectoryItemRow` 的 invalid 提示样式）

**验证：** `pnpm build` 编译通过；组件可被 ProjectsPage import；props 接口与 plan.md 一致

## T6: 项目页容器

**文件：** `src/pages/ProjectsPage.tsx`
**依赖：** T1、T4、T5
**步骤：**
1. 重写 `src/pages/ProjectsPage.tsx`（保留原文件头注释，更新 Description 为「项目管理页（项目级 MCP 配置）」）
2. import：`useState`；`lucide-react` 的 `Settings`；`@/components/ProjectCard`；`@/components/ui/button`；`@/hooks/useProjects`；`@/hooks/useDirectoryConfig`；`@/hooks/useDebouncedCheck`；`@/config/devices` 的 `PRESET_DEVICE_DIR_NAME`；`@/types/projects` 的 `ProjectItem`
3. 定义 `ProjectsPageProps`（onNavigateSettings、createOpen、onCreateClose）
4. 实现 `ProjectsPage`：
   - `useProjects()` 取 items/isLoading/addItem/updatePath/removeItem
   - `useDirectoryConfig()` 取 dirItems/dirLoading，找 toolkit 预置项：`dirItems.find(i => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME)`，得 `toolkitPath`
   - toolkit 路径用 `useDebouncedCheck(toolkitPath)` 做存在性校验（valid/invalid）
   - 页面状态分流：
     - `dirLoading || isLoading` → 「加载中...」
     - `toolkitPath.trim() === ""` 或 `useDebouncedCheck` 返回 invalid → `<GuideCard message="..." onNavigateSettings={onNavigateSettings} />`（复用设备页 GuideCard 模式，本文件内定义同名局部组件）
     - 其余 → 标题区（「项目管理」+「共 N 个项目」）+ 卡片列表
   - 卡片列表渲染：`items.map(item => <ProjectCard ... />)`，每项 props：
     - `isDuplicate`：`items.filter(i => i.path !== "" && i.path === item.path).length > 1`
     - `exists`：由 `useDebouncedCheck(item.path)` 得 status（idle→null、checking→null、valid→true、invalid→false）——但因 hook 不能在 map 内调用，改为在 ProjectCard 内部自己用 useDebouncedCheck（见 T5 已含状态检测），故此处 `exists` prop 改为「页面层不再传」，由卡片自管
   - 调整 T5 的 `ProjectCardProps`：去掉 `exists`，卡片内部用 `useDebouncedCheck(item.path)` 自管路径存在性；`isDuplicate` 仍由页面计算传入（涉及跨项比对）
   - 处理 `createOpen`：`useEffect(() => { if (createOpen) { addItem(); onCreateClose(); } }, [createOpen])`——Header 触发后追加空项并立即关闭信号
   - 空列表提示：`items.length === 0` 显示虚线框「暂无项目，点击右上角 + 添加」
5. 定义局部 `GuideCard` 组件（参考 `DevicesPage.tsx:233-246` 完全照搬）

**验证：** `pnpm build` 编译通过；页面可被 ContentArea 渲染；引导态/列表态分支齐全

## T7: Header 新增项目按钮

**文件：** `src/components/Header.tsx`
**依赖：** 无（可与 T6 并行）
**步骤：**
1. 在 `HeaderProps` 新增字段 `onAddProject: () => void`
2. 在 `Header` 函数签名解构 `onAddProject`
3. 在右侧操作区 `<div>` 内，紧跟设备按钮分支后新增项目按钮分支：
   ```tsx
   {activeTab === "projects" && (
     <Button onClick={onAddProject} variant="ghost" size="sm"
       className="hover:bg-orange-500 hover:text-white">
       <Plus className="h-4 w-4" />
       新增项目
     </Button>
   )}
   ```
4. 更新文件头 Description（追加「含项目页新增入口」）

**验证：** `pnpm build` 编译通过；Header 接受新 prop 且类型正确

## T8: 透传链打通（ContentArea + App）

**文件：** `src/components/ContentArea.tsx`、`src/App.tsx`
**依赖：** T6、T7
**步骤：**
1. **ContentArea.tsx**：
   - `ContentAreaProps` 新增 `projectCreateOpen: boolean`、`onProjectCreateClose: () => void`
   - `renderPage` 签名新增这两个参数
   - `projects` 分支改为：`<ProjectsPage onNavigateSettings={() => onSwitch("settings")} createOpen={projectCreateOpen} onCreateClose={onProjectCreateClose} />`
   - 兜底分支同步更新（保持与 devices 兜底一致的处理）
   - `ContentArea` 函数解构并透传
2. **App.tsx**：
   - 新增 `const [projectCreateOpen, setProjectCreateOpen] = useState(false)`
   - `<Header>` 传入 `onAddProject={() => setProjectCreateOpen(true)}`
   - `<ContentArea>` 传入 `projectCreateOpen={projectCreateOpen}` 与 `onProjectCreateClose={() => setProjectCreateOpen(false)}`
   - 更新 Header 调用处的注释（设备/项目并列）

**验证：** `pnpm build` 编译通过；从 Header「新增项目」到 ProjectsPage addItem 的完整透传链打通

## 执行顺序

```
T1（常量+类型）
   ├──> T2（store 扩展）──┐
   ├──> T3（纯逻辑层）───┤
   │                      ├──> T4（useProjects hook）──┐
   │                      │                             ├──> T6（ProjectsPage）──┐
   └──> T5（ProjectCard）─┘                             │                         │
                                                       │                         ├──> T8（透传链）→ 集成验证
                           T7（Header）───────────────────────────────────────────┘
```

- T1 是所有任务的基础
- T2/T3/T5 可在 T1 后并行
- T4 依赖 T1+T2
- T6 依赖 T4+T5（+T1 的类型）
- T7 仅依赖 T1 的类型约定，可与 T6 并行
- T8 依赖 T6+T7，是收口任务，完成后做集成验证
