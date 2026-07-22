# 全局 MCP 配置开关 Tasks

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/components/ui/switch.tsx` | Radix Switch 基础组件（移植自 cc-switch） |
| 新建 | `src/lib/globalMcp.ts` | ~/.claude.json 检测/写入/移除（字段级合并） |
| 新建 | `src/components/GlobalMcpSwitch.tsx` | Header 全局 MCP 开关（受控） |
| 新建 | `src/components/GlobalMcpConfirmDialog.tsx` | 开启/关闭确认对话框（复用） |
| 修改 | `src/components/Header.tsx` | 项目页分支新增开关渲染 |
| 修改 | `src/components/ProjectCard.tsx` | 配置按钮新增 globalEnabled 联动禁用 |
| 修改 | `src/pages/ProjectsPage.tsx` | 全局开关状态管理 + 文件操作编排 |
| 修改 | `src/components/ContentArea.tsx` | 透传 globalMcpChecked / onGlobalMcpToggle |
| 修改 | `src/App.tsx` | 持有 globalMcpChecked state + 透传 |

## T1: 安装依赖与 Switch 基础组件

**文件：** `src/components/ui/switch.tsx`
**依赖：** 无
**步骤：**
1. 安装依赖：`pnpm add @radix-ui/react-switch`
2. 新建 `src/components/ui/switch.tsx`，移植 cc-switch 的 `cc-switch/src/components/ui/switch.tsx`：
   - 文件头注释（Copyright / File name: switch.tsx (ui) / Author: sumu / Date: 2026/07/22 / Description: Radix Switch 拨动开关基础组件）
   - import `* as React`、`* as SwitchPrimitives from "@radix-ui/react-switch"`、`cn` from `@/lib/utils`
   - `Switch` forwardRef 组件：Root（className 绿色开/灰色关 + 圆角 + 过渡）+ Thumb（白色圆点 + translate 动画）
   - `Switch.displayName = "Switch"`
   - `export { Switch }`
   - 样式与 cc-switch 完全一致（h-6 w-11、emerald-500 开、gray-200 关）

**验证：** `pnpm build` 编译通过；`Switch` 可被 import

## T2: 全局 MCP 纯逻辑层

**文件：** `src/lib/globalMcp.ts`
**依赖：** T1（无需，仅依赖既有 config/projects 与 lib/projects）
**步骤：**
1. 新建 `src/lib/globalMcp.ts`，文件头注释
2. import：`@tauri-apps/api/path` 的 `homeDir`、`join`；`@tauri-apps/plugin-fs` 的 `exists`、`readTextFile`、`writeTextFile`；`config/projects` 的 `MCP_SERVER_NAME`；`lib/projects` 的 `buildMcpCommand`
3. 定义 `GlobalMcpStatus` 判别联合（unknown / enabled / disabled）并 export
4. 定义 `ClaudeGlobalConfig` 接口（mcpServers 可选 + 索引签名透传）——不 export（内部用）
5. 定义内部 `readGlobalConfig(): Promise<ClaudeGlobalConfig>`：
   - `const home = await homeDir()`、`const filePath = await join(home, ".claude.json")`
   - `if (!await exists(filePath)) return {}`
   - `try { const text = await readTextFile(filePath); return JSON.parse(text) as ClaudeGlobalConfig } catch { console.warn; return {} }`（spec N2 降级）
6. 定义 `getClaudeGlobalConfigPath(): Promise<string>`：`join(await homeDir(), ".claude.json")`——export
7. 定义 `detectGlobalMcp(): Promise<GlobalMcpStatus>`：
   - `const config = await readGlobalConfig()`
   - `if (config.mcpServers && config.mcpServers[MCP_SERVER_NAME]) return { kind: "enabled" }`
   - `return { kind: "disabled" }`
   - 整体 try/catch：异常返回 `{ kind: "unknown" }`（spec N3 降级）
8. 定义 `enableGlobalMcp(toolkitPath: string): Promise<void>`：
   - `const config = await readGlobalConfig()`
   - `if (!config.mcpServers) config.mcpServers = {}`
   - `config.mcpServers[MCP_SERVER_NAME] = { command: buildMcpCommand(toolkitPath) }`
   - `await writeTextFile(await getClaudeGlobalConfigPath(), JSON.stringify(config, null, 2))`
   - 不 try/catch 吞错，IO 异常向上抛
9. 定义 `disableGlobalMcp(): Promise<void>`：
   - `const config = await readGlobalConfig()`
   - `if (config.mcpServers && config.mcpServers[MCP_SERVER_NAME]) delete config.mcpServers[MCP_SERVER_NAME]`
   - `await writeTextFile(await getClaudeGlobalConfigPath(), JSON.stringify(config, null, 2))`
   - 不 try/catch 吞错

**验证：** `pnpm build` 编译通过；函数签名与 plan.md 一致

## T3: 全局 MCP 开关组件

**文件：** `src/components/GlobalMcpSwitch.tsx`
**依赖：** T1
**步骤：**
1. 新建 `src/components/GlobalMcpSwitch.tsx`，文件头注释
2. import：`Switch` from `@/components/ui/switch`
3. 定义 `GlobalMcpSwitchProps`（checked: boolean、onCheckedChange: (checked: boolean) => void）
4. 实现 `GlobalMcpSwitch`：
   - 渲染一个带 label 的开关容器：`<div className="flex items-center gap-2">`
   - label 文案「全局 MCP」（`<span className="text-sm text-muted-foreground">`）
   - `<Switch checked={checked} onCheckedChange={onCheckedChange} aria-label="全局 MCP 配置开关" />`
   - 纯受控组件，不持有状态，不操作文件

**验证：** `pnpm build` 编译通过；组件可被 Header import

## T4: 确认对话框组件

**文件：** `src/components/GlobalMcpConfirmDialog.tsx`
**依赖：** 无（仅依赖既有 ui/dialog）
**步骤：**
1. 新建 `src/components/GlobalMcpConfirmDialog.tsx`，文件头注释
2. import：`Dialog` from `@/components/ui/dialog`
3. 定义 `GlobalMcpConfirmDialogProps`（open: boolean、action: "enable" | "disable"、onConfirm: () => void、onClose: () => void）
4. 定义文案映射（参考 spec 确认的文案）：
   - enable：title="启用全局 MCP 配置"、正文「启用全局 MCP 配置后，embedded-board 将对所有项目生效，项目级配置按钮将被禁用。是否继续？」、确认按钮「启用」
   - disable：title="关闭全局 MCP 配置"、正文「关闭全局 MCP 配置后，将从 ~/.claude.json 移除 embedded-board，项目级配置按钮恢复可用。是否继续？」、确认按钮「关闭」
5. 实现 `GlobalMcpConfirmDialog`：
   - `<Dialog open={open} onClose={onClose} title={title}>`
   - 正文 `<p className="text-sm text-foreground">{message}</p>`
   - 按钮区（参考 DeviceDeleteDialog 的样式）：取消（outline 风格）+ 确认（default/destructive 风格）
   - 确认按钮 enable 用 default 蓝色、disable 用 destructive 红色（语义区分）

**验证：** `pnpm build` 编译通过；组件可被 ProjectsPage import

## T5: ProjectCard 配置按钮联动禁用

**文件：** `src/components/ProjectCard.tsx`
**依赖：** 无
**步骤：**
1. 在 `ProjectCardProps` 新增字段 `globalEnabled: boolean`（全局 MCP 是否启用，默认 false）
2. 在 `ProjectCard` 函数签名解构 `globalEnabled`
3. 修改「配置」按钮的可用性逻辑：
   - 原：`const isConfigured = status.kind === "ok"` → `const configDisabled = globalEnabled || status.kind === "ok"`
   - 按钮 `disabled={configDisabled}`
   - className：`configDisabled` 时 `opacity-50`（无 hover），否则橙色 hover
   - title：`globalEnabled` 时「全局配置已启用，项目级配置已禁用」；`isConfigured` 时「已配置」；否则「配置 MCP」

**验证：** `pnpm build` 编译通过；ProjectCard 接受新 prop

## T6: ProjectsPage 状态管理与编排

**文件：** `src/pages/ProjectsPage.tsx`
**依赖：** T2、T3、T4、T5
**步骤：**
1. import 新增：`detectGlobalMcp`、`enableGlobalMcp`、`disableGlobalMcp` from `@/lib/globalMcp`；`GlobalMcpConfirmDialog` from `@/components/GlobalMcpConfirmDialog`
2. `ProjectsPageProps` 新增 `globalMcpChecked: boolean`、`onGlobalMcpCheckedChange: (checked: boolean) => void`（向上报到 App，驱动 Header 开关视觉）
3. 新增内部 state：`const [confirmAction, setConfirmAction] = useState<"enable" | "disable" | null>(null)`
4. 挂载时检测全局状态 effect：
   ```
   useEffect(() => {
     let cancelled = false;
     (async () => {
       const status = await detectGlobalMcp();
       if (cancelled) return;
       onGlobalMcpCheckedChange(status.kind === "enabled");
     })();
     return () => { cancelled = true; };
   }, []);  // 仅挂载时检测一次
   ```
5. 新增 `handleToggleGlobalMcp(checked: boolean)`：
   - `checked === true` → `setConfirmAction("enable")`
   - `checked === false` → `setConfirmAction("disable")`
   - 注意：此函数作为 onCheckedChange 传给 Header 开关（经 App 透传）
6. 新增 `handleConfirmGlobalMcp` async：
   ```
   if (!confirmAction) return;
   try {
     if (confirmAction === "enable") await enableGlobalMcp(toolkitPath);
     else await disableGlobalMcp();
     const status = await detectGlobalMcp();
     const enabled = status.kind === "enabled";
     onGlobalMcpCheckedChange(enabled);  // 上报 App 更新 Header 开关
     show(confirmAction === "enable" ? "已启用全局 MCP 配置" : "已关闭全局 MCP 配置", "success");
   } catch (error) {
     console.warn(...); show("全局 MCP 配置操作失败", "error");
   } finally {
     setConfirmAction(null);  // 关闭对话框
   }
   ```
7. 透传 `globalEnabled={globalMcpChecked}` 给每个 `<ProjectCard>`
8. 在 JSX 末尾渲染 `<GlobalMcpConfirmDialog open={confirmAction !== null} action={confirmAction ?? "enable"} onConfirm={handleConfirmGlobalMcp} onClose={() => setConfirmAction(null)} />`

**验证：** `pnpm build` 编译通过；ProjectsPage 接受新 props 且内部逻辑完整

## T7: Header 开关渲染

**文件：** `src/components/Header.tsx`
**依赖：** T3
**步骤：**
1. import `GlobalMcpSwitch` from `@/components/GlobalMcpSwitch`
2. `HeaderProps` 新增 `globalMcpChecked: boolean`、`onGlobalMcpToggle: (checked: boolean) => void`
3. 在 `Header` 函数签名解构这两个新 prop
4. 在项目页分支（`activeTab === "projects"`），在「新增项目」按钮**左侧**渲染开关：
   ```tsx
   {activeTab === "projects" && (
     <>
       <GlobalMcpSwitch
         checked={globalMcpChecked}
         onCheckedChange={onGlobalMcpToggle}
       />
       <Button onClick={onAddProject} variant="ghost" size="sm"
         className="hover:bg-orange-500 hover:text-white">
         <Plus className="h-4 w-4" />
         新增项目
       </Button>
     </>
   )}
   ```
5. 更新文件头 Description（追加「全局 MCP 开关」）

**验证：** `pnpm build` 编译通过；Header 接受新 props

## T8: 透传链打通（ContentArea + App）

**文件：** `src/components/ContentArea.tsx`、`src/App.tsx`
**依赖：** T6、T7
**步骤：**
1. **ContentArea.tsx**：
   - `ContentAreaProps` 新增 `globalMcpChecked: boolean`、`onGlobalMcpToggle: (checked: boolean) => void`、`onGlobalMcpCheckedChange: (checked: boolean) => void`
   - `renderPage` 签名新增这三个参数
   - `projects` 分支透传给 ProjectsPage：`<ProjectsPage ... globalMcpChecked={globalMcpChecked} onGlobalMcpCheckedChange={onGlobalMcpCheckedChange} onGlobalMcpToggle={onGlobalMcpToggle} />`
   - 同时透传 `globalMcpChecked`、`onGlobalMcpToggle` 给 Header（Header 在 App 渲染，非 ContentArea 内——此处仅需透传给 ProjectsPage）
   - `ContentArea` 函数解构并透传
2. **App.tsx**：
   - 新增 `const [globalMcpChecked, setGlobalMcpChecked] = useState(false)`
   - `<Header>` 传入 `globalMcpChecked={globalMcpChecked}` 与 `onGlobalMcpToggle={(checked) => setGlobalMcpChecked(checked)}`（注意：这里 setGlobalMcpChecked 先乐观更新视觉，实际文件操作与最终状态由 ProjectsPage 的确认流程回调 setGlobalMcpChecked 校正）
   - **重新审视乐观更新**：若 App 层先 setGlobalMcpChecked(checked) 会让开关立即跳变，与「确认框期间回弹」矛盾。正确做法：App 的 onGlobalMcpToggle 只**转发事件**给 ProjectsPage，**不直接改 state**；state 由 ProjectsPage 的检测/确认流程通过 onGlobalMcpCheckedChange 回调更新
   - 因此 App 的 `onGlobalMcpToggle` 需要转发到 ProjectsPage——但 Header 在 App、ProjectsPage 在 ContentArea，App 无法直接调 ProjectsPage 的函数。**解决方案**：用 ref 或提升 toggle handler 到 App。采用更简单的方案——**把确认逻辑整体提升到 App**：
     - App 持有 `globalMcpChecked` + `confirmAction` + toolkitPath（App 也调 useDirectoryConfig 取 toolkit 路径）
     - App 渲染 `<GlobalMcpConfirmDialog>`
     - App 的 `handleGlobalMcpToggle` 直接弹确认框、操作文件、刷新
     - ProjectsPage 不再管全局开关，只接收 `globalMcpChecked` prop 透传给卡片
   - **修正方案**（见下方「实现层调整」）

**实现层调整（T8 方案修正）：**
由于 Header（在 App）与确认逻辑需要 toolkitPath（来自 useDirectoryConfig），而 ProjectsPage 也在用 useDirectoryConfig，为避免双实例与状态分散，**将全局开关的完整编排逻辑提升到 App 层**：
- App 持有：`globalMcpChecked`、`confirmAction`、toolkitPath（App 调 `useDirectoryConfig`）
- App 渲染 `GlobalMcpConfirmDialog`
- App 的 `handleToggle` / `handleConfirm` 完整编排
- App 透传 `globalMcpChecked` 给 ContentArea → ProjectsPage → ProjectCard（仅用于禁用按钮）
- ProjectsPage 不再负责全局开关，移除 T6 中与全局开关相关的逻辑（步骤 2-8 中关于 confirm/onCheckedChange 的部分），仅保留透传 `globalEnabled` 给 ProjectCard

**验证：** `pnpm build` 编译通过；从 Header 开关到文件操作的完整链路打通

## 执行顺序

```
T1（依赖安装 + Switch 组件）──┐
                              ├──> T3（GlobalMcpSwitch）──┐
T2（globalMcp 纯逻辑）────────┤                            ├──> T7（Header）──┐
                              │                            │                  │
T4（确认对话框）──────────────┘                            │                  ├──> T8（App 编排）→ 集成验证
                                                          │                  │
T5（ProjectCard 联动）─────────────────────────────────────┤                  │
                                                          │                  │
T6（ProjectsPage 透传，精简后）─────────────────────────────┘──────────────────┘
```

- T1/T2/T4/T5 可并行（无相互依赖）
- T3 依赖 T1
- T6/T7 依赖 T3
- T8 依赖全部，是收口任务（含方案修正：编排逻辑提升到 App）
