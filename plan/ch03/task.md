<!-- more -->

# 设置页目录配置 Tasks

## 一、文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/types/settings.ts` | `DirectoryItem` / `DirectoryValidation` 类型 |
| 新建 | `src/config/settings.ts` | `STORE_FILE` / `DIRECTORY_CONFIG_KEY` 常量 |
| 新建 | `src/lib/store.ts` | Tauri Store 单例封装（load + read + write） |
| 新建 | `src/components/ui/input.tsx` | shadcn Input（forwardRef） |
| 新建 | `src/components/ui/label.tsx` | shadcn Label（原生 label 实现） |
| 新建 | `src/hooks/useDirectoryConfig.ts` | 列表状态 + 异步持久化 |
| 新建 | `src/hooks/useDebouncedCheck.ts` | 路径存在性防抖校验 |
| 新建 | `src/components/DirectoryItemRow.tsx` | 目录项单行组件 |
| 修改 | `src/pages/SettingsPage.tsx` | 从占位页改为目录配置页 |
| 修改 | `package.json` | 加三个 plugin npm 依赖 |
| 修改 | `src-tauri/Cargo.toml` | 加三个 plugin Rust crate |
| 修改 | `src-tauri/capabilities/default.json` | permissions 追加三项 |
| 修改 | `src-tauri/src/lib.rs` | Builder 链注册三个插件 |

## 二、任务列表

### T1: Tauri 插件接入（npm 侧）

**文件：** `package.json`
**依赖：** 无
**步骤：**

1. 执行 `pnpm add @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-store`
2. 验证 `package.json` 的 dependencies 含三个新依赖，且换行符保持原状（CRLF）
3. 验证 `pnpm install` 无报错

**验证：** `cat package.json | grep plugin-` 输出三行；`pnpm tsc --noEmit` 通过（依赖类型可用）

---

### T2: Tauri 插件接入（Cargo 侧）

**文件：** `src-tauri/Cargo.toml`
**依赖：** 无（可与 T1 并行）
**步骤：**

1. 在 `src-tauri/` 目录下执行：
   ```
   cargo add tauri-plugin-dialog
   cargo add tauri-plugin-fs
   cargo add tauri-plugin-store
   ```
2. 验证 `Cargo.toml` 的 `[dependencies]` 段新增三行，版本均为 `"2"`
3. 执行 `cargo check --manifest-path src-tauri/Cargo.toml`，确认依赖可解析

**验证：** `grep tauri-plugin src-tauri/Cargo.toml` 输出三行；`cargo check` 无错误

---

### T3: Tauri 插件接入（Rust 注册）

**文件：** `src-tauri/src/lib.rs`
**依赖：** T2
**步骤：**

1. 读取 `src-tauri/src/lib.rs` 确认当前编码（应为 LF 或 CRLF，保持不变）
2. 在 `tauri::Builder::default()` 链上，`.plugin(tauri_plugin_opener::init())` 之后追加三行：
   ```rust
   .plugin(tauri_plugin_dialog::init())
   .plugin(tauri_plugin_fs::init())
   .plugin(tauri_plugin_store::Builder::default().build())
   ```
3. 保持文件其余部分（含注释）原样

**验证：** `cargo check --manifest-path src-tauri/Cargo.toml` 通过；`pnpm tauri dev` 能启动（不报插件加载错误）

---

### T4: Tauri 插件接入（capabilities 权限）

**文件：** `src-tauri/capabilities/default.json`
**依赖：** 无（可与 T2/T3 并行）
**步骤：**

1. 读取确认原文件格式（JSON，CRLF 换行，2 空格缩进）
2. 在 `permissions` 数组中追加三项：
   ```json
   "permissions": [
     "core:default",
     "opener:default",
     "dialog:default",
     "fs:default",
     "store:default"
   ]
   ```
3. 保持 JSON 其余结构与换行符不变

**验证：** JSON 语法合法（`node -e "JSON.parse(require('fs').readFileSync('src-tauri/capabilities/default.json','utf8'))"` 无异常）；`pnpm tauri dev` 启动无权限错误

---

### T5: 新建设置类型定义

**文件：** `src/types/settings.ts`
**依赖：** 无
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 定义 `DirectoryItem` 接口（`id: string` / `path: string`，字段加 JSDoc）
3. 定义 `DirectoryValidation` 判别联合类型：
   - `{ status: "idle" }`
   - `{ status: "checking" }`
   - `{ status: "valid" }`
   - `{ status: "invalid" }`
   每个分支加 JSDoc

**验证：** `pnpm tsc --noEmit` 通过

---

### T6: 新建设置常量

**文件：** `src/config/settings.ts`
**依赖：** 无
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导出 `STORE_FILE = "settings.json"`（JSDoc 注明用途）
3. 导出 `DIRECTORY_CONFIG_KEY = "directory-config"`（JSDoc 注明用途）
4. 用 `as const` 冻结

**验证：** `pnpm tsc --noEmit` 通过

---

### T7: 新建 Store 封装模块

**文件：** `src/lib/store.ts`
**依赖：** T1（plugin-store 已装）、T6
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `load`、`type Store` from `@tauri-apps/plugin-store`；`STORE_FILE` / `DIRECTORY_CONFIG_KEY` from `@/config/settings`
3. 实现 `isTauriEnv()` 工具函数：检测 `typeof window !== "undefined" && "__TAURI_INTERNALS__" in window`（或 `__TAURI__`），返回 boolean
4. 实现 `loadStore(): Promise<Store>`：非 Tauri 环境抛特定错误（由调用方 catch）；Tauri 环境 `return await load(STORE_FILE, { autoSave: false })`
5. 实现 `readDirectoryConfig(): Promise<readonly string[]>`：
   - 非 Tauri 返回 `[]`
   - Tauri 环境 `try { const store = await loadStore(); const raw = await store.get<string[]>(DIRECTORY_CONFIG_KEY); return isValidPathArray(raw) ? raw : [] } catch { return [] }`
6. 实现 `writeDirectoryConfig(paths: readonly string[]): Promise<void>`：
   - 非 Tauri 直接 return
   - Tauri 环境 `try { const store = await loadStore(); await store.set(DIRECTORY_CONFIG_KEY, Array.from(paths)); await store.save() } catch (e) { console.warn } `
7. 实现 `isValidPathArray(value): boolean` 类型守卫：判断 `Array.isArray` 且每项为 `string`

**验证：** `pnpm tsc --noEmit` 通过；手动 review 逻辑（非 Tauri 降级路径正确）

---

### T8: 新建 Input 基础组件

**文件：** `src/components/ui/input.tsx`
**依赖：** 无
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `* as React`、`cn` from `@/lib/utils`
3. 定义 `InputProps extends React.ComponentProps<"input">`
4. 实现 `Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => ...)`
5. className 用 `cn(...)`，base 样式按 plan 3.7 节：
   `"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-500"`
6. 渲染 `<input type={type} className={...} ref={ref} {...props} />`
7. `displayName = "Input"`，末尾 `export { Input }`

**验证：** `pnpm tsc --noEmit` 通过；能在测试代码 `<Input value="" onChange={() => {}} />` 正常渲染

---

### T9: 新建 Label 基础组件

**文件：** `src/components/ui/label.tsx`
**依赖：** 无（可与 T8 并行）
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `* as React`、`cn` from `@/lib/utils`
3. 定义 `LabelProps extends React.ComponentProps<"label">`
4. 实现 `Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => ...)`
5. className 用 `cn("text-sm font-medium leading-none", className)`
6. 渲染 `<label ref={ref} className={...} {...props} />`
7. `displayName = "Label"`，末尾 `export { Label }`

**验证：** `pnpm tsc --noEmit` 通过

---

### T10: 新建 useDirectoryConfig Hook

**文件：** `src/hooks/useDirectoryConfig.ts`
**依赖：** T5、T7
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `useCallback`、`useEffect`、`useState` from `react`；`readDirectoryConfig` / `writeDirectoryConfig` from `@/lib/store`；`type { DirectoryItem }` from `@/types/settings`
3. 定义 `UseDirectoryConfigResult` 接口（items / isLoading / addItem / removeItem / updatePath），字段加 JSDoc
4. 实现 `useDirectoryConfig(): UseDirectoryConfigResult`：
   - `const [items, setItems] = useState<DirectoryItem[]>([])`
   - `const [isLoading, setIsLoading] = useState(true)`
   - `useEffect(() => { let cancelled = false; (async () => { const paths = await readDirectoryConfig(); if (!cancelled) { setItems(paths.map(p => ({ id: crypto.randomUUID(), path: p }))); setIsLoading(false) } })(); return () => { cancelled = true } }, [])`
   - `addItem = useCallback(() => { setItems(prev => { const next = [...prev, { id: crypto.randomUUID(), path: "" }]; void writeDirectoryConfig(next.map(i => i.path)); return next }) }, [])`
   - `removeItem = useCallback((id: string) => { setItems(prev => { const next = prev.filter(i => i.id !== id); void writeDirectoryConfig(next.map(i => i.path)); return next }) }, [])`
   - `updatePath = useCallback((id: string, path: string) => { setItems(prev => { const next = prev.map(i => i.id === id ? { ...i, path } : i); void writeDirectoryConfig(next.map(i => i.path)); return next }) }, [])`
   - 返回 `{ items, isLoading, addItem, removeItem, updatePath }`

**验证：** `pnpm tsc --noEmit` 通过；逻辑 review（函数式更新避免闭包陈旧值、cancelled 标志防卸载后 setState）

---

### T11: 新建 useDebouncedCheck Hook

**文件：** `src/hooks/useDebouncedCheck.ts`
**依赖：** T1（plugin-fs 已装）、T5
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `useEffect`、`useRef`、`useState` from `react`；`exists` from `@tauri-apps/plugin-fs`；`type { DirectoryValidation }` from `@/types/settings`
3. 实现 `isTauriEnv()`（与 lib/store.ts 一致，可抽到 lib/ 但本章节各放一份避免循环依赖）
4. 实现 `useDebouncedCheck(path: string, debounceMs = 400): DirectoryValidation`：
   - `const [state, setState] = useState<DirectoryValidation>({ status: "idle" })`
   - `const timerRef = useRef<ReturnType<typeof setTimeout>>`
   - `useEffect(() => { if (!path.trim()) { setState({ status: "idle" }); return }; if (!isTauriEnv()) { setState({ status: "idle" }); return }; setState({ status: "checking" }); timerRef.current = setTimeout(async () => { try { const ok = await exists(path); setState(ok ? { status: "valid" } : { status: "invalid" }) } catch { setState({ status: "invalid" }) } }, debounceMs); return () => clearTimeout(timerRef.current) }, [path, debounceMs])`
   - 返回 `state`

**验证：** `pnpm tsc --noEmit` 通过；逻辑 review（卸载时 clear timer、catch 覆盖 exists 异常）

---

### T12: 新建 DirectoryItemRow 组件

**文件：** `src/components/DirectoryItemRow.tsx`
**依赖：** T5、T8、T9、T11
**步骤：**

1. 新建文件（UTF-8 LF + 版权头）
2. 导入 `useEffect`、`useRef` from `react`；`FolderOpen`、`Trash2` from `lucide-react`；`Button` from `@/components/ui/button`；`Input` from `@/components/ui/input`；`useDebouncedCheck` from `@/hooks/useDebouncedCheck`；`type { DirectoryItem }` from `@/types/settings`
3. 定义 `DirectoryItemRowProps` 接口（item / onPathChange / onRemove / onPickDirectory / autoFocus?），字段加 JSDoc
4. 实现 `basename(path: string): string` 工具函数：按 `/` 和 `\` 分割取最后非空段，空路径返回 `""`
5. 实现 `DirectoryItemRow({ item, onPathChange, onRemove, onPickDirectory, autoFocus }: DirectoryItemRowProps)`：
   - `const name = item.path ? basename(item.path) : "未命名"`
   - `const validation = useDebouncedCheck(item.path)`
   - `const inputRef = useRef<HTMLInputElement>(null)`
   - `useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])`
   - JSX 按 plan 3.5 节模板：主体行（名称 span + Input + 打开 Button + 删除 Button）+ 校验提示 p（仅 invalid 时显示）
   - Input 的 `aria-invalid={validation.status === "invalid"}`、`aria-describedby` 关联错误 p 的 id
   - 打开/删除按钮 onClick 分别调 `onPickDirectory(item.id)` / `onRemove(item.id)`，事件不阻止冒泡（父组件无卡片选中逻辑）

**验证：** `pnpm tsc --noEmit` 通过；validation 为 invalid 时 className 含红字、Input 含 aria-invalid

---

### T13: 改造 SettingsPage

**文件：** `src/pages/SettingsPage.tsx`
**依赖：** T10、T12、T1（plugin-dialog 已装）
**步骤：**

1. 读取原文件确认编码（应为 UTF-8 LF）
2. 完全重写（保持版权头格式，Description 改为"设置页（目录配置）"）：
   - 导入 `useCallback` from `react`；`open` from `@tauri-apps/plugin-dialog`；`Plus` from `lucide-react`；`Button` from `@/components/ui/button`；`Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` from `@/components/ui/card`；`DirectoryItemRow` from `@/components/DirectoryItemRow`；`useDirectoryConfig` from `@/hooks/useDirectoryConfig`
3. 实现 `function SettingsPage(): React.ReactElement`：
   - `const { items, isLoading, addItem, removeItem, updatePath } = useDirectoryConfig()`
   - `const handlePickDirectory = useCallback(async (id: string) => { try { const selected = await open({ directory: true, title: "选择目录" }); if (typeof selected === "string") updatePath(id, selected) } catch { /* 用户取消或异常，静默 */ } }, [updatePath])`
   - JSX 按 plan 3.6 节模板：标题区 + Card(CardHeader + CardContent(加载态/列表/空状态/添加按钮))
   - 列表渲染：`items.map((item, index) => <DirectoryItemRow key={item.id} item={item} autoFocus={index === items.length - 1 && item.path === ""} onPathChange={updatePath} onRemove={removeItem} onPickDirectory={handlePickDirectory} />)`

**验证：** `pnpm tsc --noEmit` 通过；`pnpm build` 成功

---

### T14: 集成验证

**文件：** 全项目
**依赖：** T1-T13 全部完成
**步骤：**

1. `pnpm tsc --noEmit`，确认无 TS 错误
2. `pnpm build`，确认 Vite 产物正常
3. `pnpm tauri dev` 启动应用（这是关键——必须真实启动 Tauri 才能测 dialog/fs/store）
4. 人工验证：
   - 点"设置"Tab → 看到"应用设置 / 目录配置"标题 + 加载态闪过 + 空状态
   - 点"添加目录" → 新项出现、输入框聚焦
   - 输入真实路径（如 `C:/Users`）→ 等待 400ms → 无红字
   - 输入假路径（如 `Z:/nope`）→ 400ms 后显示"目录不存在"
   - 点"打开目录" → 弹系统对话框 → 选目录 → 路径自动填入
   - 点"删除" → 项消失
   - 重启应用 → 配置恢复
   - 检查 `%APPDATA%/com.tauri-app.toolkit-manager/settings.json` 存在且内容正确

**验证：** 上述 8 项全部符合预期；编译与 tauri dev 启动无 error

## 三、执行顺序

```
基础设施层（Tauri 插件 + 类型 + 常量）：
T1 ─┐
T2 ─┤
T3 ─┤ (依赖 T2)
T4 ─┤                            T5 ── T6
    │                                     │
    └──────┬──────────────────────────────┘
           ▼
T7 (Store 封装，依赖 T1+T6)
           │
           ▼
T10 (useDirectoryConfig，依赖 T5+T7)      T11 (useDebouncedCheck，依赖 T1+T5)
           │                                     │
           │     T8 (Input) ── T9 (Label)        │
           │           │                         │
           └───────────┴────────┬────────────────┘
                                ▼
                           T12 (DirectoryItemRow，依赖 T5+T8+T11)
                                │
                                ▼
                           T13 (SettingsPage，依赖 T10+T12+T1)
                                │
                                ▼
                           T14 (集成验证)
```

**建议执行序列（线性最稳）：**

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13 → T14
```

**可并行优化（若想提速）：**

- T1 / T2 / T4 / T5 / T6 / T8 / T9 互相独立，可批量并行
- T3 必须等 T2
- T7 等 T1+T6
- T10 等 T5+T7；T11 等 T1+T5
- T12 等 T5+T8+T11
- T13 等 T10+T12+T1

## 四、风险与注意事项

| 风险 | 应对 |
|------|------|
| Tauri 插件版本与 Tauri core 不兼容 | `cargo add` / `pnpm add` 会自动选兼容版本；若 `cargo check` 报版本冲突，回退到 `"2"` 通配 |
| `crypto.randomUUID()` 在非安全上下文不可用 | Tauri WebView 是安全上下文（https equivalent），可用；但加 `try/catch` 兜底（失败时用 `Date.now() + Math.random()`） |
| `exists()` 对网络路径/超长路径响应慢 | debounce 400ms 已缓解；若用户反馈卡顿，后续章节可加超时（`Promise.race`） |
| Tauri Store 写入失败（磁盘满/权限） | `writeDirectoryConfig` 已 catch + console.warn，UI 不崩 |
| 非 Tauri 环境（`pnpm dev` 纯浏览器）调用插件 API | `lib/store.ts` 与 `useDebouncedCheck.ts` 都有 `isTauriEnv()` 降级；SettingsPage 的 `open()` 调用包 try/catch |
| `package.json` / `Cargo.toml` 被工具转为 LF | 全程用 `pnpm add` / `cargo add`；T13 后 `git diff --stat` 检查换行符 |
| Store 文件路径在不同 OS 不同 | 由 Tauri 自动解析到 appDataDir，前端无需关心；调试时用 `%APPDATA%\com.tauri-app.toolkit-manager`（Win） |
| 新增项 autoFocus 抢焦已有项 | D11 策略：仅最后一项且 path 为空时 autoFocus；T13 中条件判断 `index === items.length - 1 && item.path === ""` |

---

*本文档由 code-spec 技能辅助生成*
