<!-- more -->

# 设置页目录配置 Checklist

> 每一项通过运行代码或观察行为来验证，聚焦系统行为。验收时逐项执行，记录实际结果与证据。

## 一、实现完整性

- [ ] **类型定义存在**（验证：`src/types/settings.ts` 导出 `DirectoryItem` 与 `DirectoryValidation`，`pnpm tsc --noEmit` 通过）
- [ ] **常量定义存在**（验证：`src/config/settings.ts` 导出 `STORE_FILE = "settings.json"` 与 `DIRECTORY_CONFIG_KEY = "directory-config"`）
- [ ] **Store 封装可用**（验证：`src/lib/store.ts` 导出 `loadStore` / `readDirectoryConfig` / `writeDirectoryConfig` 三个函数）
- [ ] **Input 组件可用**（验证：`src/components/ui/input.tsx` 导出 `Input`，支持 `forwardRef`，含 `aria-[invalid=true]` 红边框样式）
- [ ] **Label 组件可用**（验证：`src/components/ui/label.tsx` 导出 `Label`，基于原生 `<label>` 实现）
- [ ] **useDirectoryConfig 可用**（验证：`src/hooks/useDirectoryConfig.ts` 导出 hook，返回 `{ items, isLoading, addItem, removeItem, updatePath }`）
- [ ] **useDebouncedCheck 可用**（验证：`src/hooks/useDebouncedCheck.ts` 导出 hook，接收 `path` 与可选 `debounceMs`，返回 `DirectoryValidation`）
- [ ] **DirectoryItemRow 可用**（验证：`src/components/DirectoryItemRow.tsx` 导出组件，接收 `item` / `onPathChange` / `onRemove` / `onPickDirectory` / `autoFocus?`）

## 二、集成

- [ ] **设置页已接入目录配置**（验证：`src/pages/SettingsPage.tsx` 不再 import `PlaceholderPage`，改为渲染 `Card` + `DirectoryItemRow` 列表 + 添加按钮）
- [ ] **Tauri 插件 npm 依赖到位**（验证：`grep plugin- package.json` 输出含 `@tauri-apps/plugin-dialog` / `plugin-fs` / `plugin-store` 三项）
- [ ] **Tauri 插件 Cargo 依赖到位**（验证：`grep tauri-plugin src-tauri/Cargo.toml` 输出含三个 crate）
- [ ] **Rust 侧插件注册**（验证：`src-tauri/src/lib.rs` 的 Builder 链含三个 `.plugin(...)` 调用）
- [ ] **capabilities 权限授予**（验证：`src-tauri/capabilities/default.json` 的 permissions 数组含 `dialog:default` / `fs:default` / `store:default`）
- [ ] **Store 文件正确生成**（验证：首次写入配置后，`%APPDATA%\com.tauri-app.toolkit-manager\settings.json` 存在，内容为含 `directory-config` 键的 JSON）
- [ ] **Input 被表单使用**（验证：`DirectoryItemRow` 内 import 并渲染了 `Input`）
- [ ] **Button 被操作区使用**（验证：`DirectoryItemRow` 的"打开目录"与"删除"按钮均用 `<Button variant="outline|ghost" size="icon">`）

## 三、编译与测试

- [ ] **TypeScript 类型检查通过**（验证：运行 `pnpm tsc --noEmit`，退出码 0，无 error）
- [ ] **Vite 构建成功**（验证：运行 `pnpm build`，`dist/` 目录生成产物，无构建错误）
- [ ] **Rust 编译通过**（验证：`cargo check --manifest-path src-tauri/Cargo.toml` 退出码 0）
- [ ] **Tauri 应用启动成功**（验证：`pnpm tauri dev` 启动后无插件加载错误、无权限拒绝错误，窗口正常显示）
- [ ] **无未使用变量告警**（验证：`tsconfig.json` 已开启 `noUnusedLocals` / `noUnusedParameters`，编译通过即代表无未使用项）
- [ ] **代码符合 ts-lang-spec**（验证：人工抽查——新建文件带版权头、组件用 `function` 或 `forwardRef` 声明、Props 接口含 JSDoc、导入分三组）
- [ ] **文件编码未被破坏**（验证：新建文件 UTF-8 LF；`package.json` / `Cargo.toml` / `tauri.conf.json` / `capabilities/default.json` / `lib.rs` 保持原 CRLF——用 `file` 命令或 `git diff --stat` 核对换行符无变化）
- [ ] **`cn()` 工具被复用**（验证：所有条件化 className 均经 `cn()` 合并）

## 四、端到端场景

### 场景 1：首次进入设置页

**操作：** 启动应用（`pnpm tauri dev`）→ 点击侧边栏"设置"Tab
**预期：** 内容区显示"应用设置 / 目录配置 · 管理应用关注的本地目录"标题；下方卡片标题"目录配置" + 描述；首次进入（Store 无数据）时先短暂显示"加载中..."，随后列表为空，显示虚线边框的"暂无目录，点击下方添加"提示；底部有"添加目录"按钮

### 场景 2：添加目录项

**操作：** 点击"添加目录"按钮
**预期：** 列表末尾出现一个新行：左侧名称"未命名"、中间空输入框（占位符"请输入或选择目录路径"）、右侧"打开目录"和"删除"两个图标按钮；新行的输入框自动获得焦点（光标在内）；此时无红字校验提示（空路径不校验）

### 场景 3：手动输入有效路径

**操作：** 在某行输入框键入一个真实存在的目录路径（如 `C:/Users`）
**预期：** 名称立即变为 `Users`（派生自路径末尾段）；输入停止约 400ms 后，无红字提示（路径有效）；Store 文件 `settings.json` 中 `directory-config` 数组更新含该路径

### 场景 4：手动输入无效路径

**操作：** 在某行输入框键入一个不存在的路径（如 `Z:/nonexistent`）
**预期：** 名称变为 `nonexistent`；输入停止约 400ms 后，输入框下方出现红字"目录不存在"；输入框边框变红（`aria-[invalid=true]` 触发）；**但仍允许保存**——Store 中仍写入该路径

### 场景 5：打开目录选择器

**操作：** 点击某行的"打开目录"按钮（FolderOpen 图标）
**预期：** 弹出系统原生文件夹选择对话框（标题"选择目录"）；选择一个真实目录并确认 → 该行输入框自动填充所选绝对路径 → 名称变为所选目录名 → 校验提示为"有效"（隐藏）→ Store 更新。点击对话框取消/关闭 → 无任何变化，输入框内容不变

### 场景 6：删除目录项

**操作：** 点击某行的"删除"按钮（Trash2 图标）
**预期：** 该行立即从列表消失（无二次确认弹窗）；Store 中对应项移除；其他行顺序不变；列表为空后显示空状态提示

### 场景 7：配置跨重启持久化

**操作：** 添加 2-3 个目录项并填写路径 → 关闭应用 → 重新 `pnpm tauri dev` 启动 → 进入设置页
**预期：** 列表加载后显示之前的所有目录项，路径与名称完全恢复；`%APPDATA%\com.tauri-app.toolkit-manager\settings.json` 文件内容与配置一致

### 场景 8：直接编辑 Store 文件

**操作：** 关闭应用 → 用记事本打开 `%APPDATA%\com.tauri-app.toolkit-manager\settings.json` → 手动修改 `directory-config` 数组（增删改几条路径）→ 保存 → 启动应用
**预期：** 设置页加载后显示手动编辑后的目录列表（验证 Store 是真实文件、双向可编辑）

### 场景 9：暗色模式

**操作：** 切换系统到暗色模式（或给 `<html>` 加 `class="dark"`）→ 进入设置页
**预期：** 标题、卡片、输入框、按钮、校验红字、空状态虚线边框均正确反色；校验红字在暗色下可读（`dark:text-red-400`）；对比度无问题

### 场景 10：键盘可访问性

**操作：** Tab 键遍历设置页元素
**预期：** 添加目录按钮、各行的输入框、打开按钮、删除按钮均可通过 Tab 聚焦；焦点环（focus-visible）清晰可见；屏幕阅读器能播报"目录不存在"错误（通过 `aria-invalid` + `aria-describedby`）

### 场景 11：错误降级

**操作：** 模拟 Store 写入失败（手动把 settings.json 设为只读 → 修改配置）；模拟 dialog 异常（理论上难复现，可跳过或用 DevTools 覆盖 `open` 函数抛错）
**预期：** 写入失败时 UI 不崩溃，控制台有 `console.warn`，操作仍可用；dialog 异常时按钮不卡死，try/catch 静默处理

### 场景 12：非 Tauri 环境降级

**操作：** 执行 `pnpm dev`（不走 tauri，纯 Vite）→ 浏览器打开 `http://localhost:1420` → 进入设置页
**预期：** 页面不抛未捕获异常；添加目录可用（内存态）；输入路径不触发校验（fs 不可用，降级为 idle）；点"打开目录"按钮不崩溃（dialog 不可用，try/catch 静默）；刷新后配置丢失（因未真正落盘，仅内存）

## 五、范围边界核对（不应出现的能力）

> 这些是 spec 明确排除的，验收时确认它们**不存在**，避免范围蔓延。

- [ ] **未做目录名称自定义**（验证：DirectoryItemRow 中名称只读展示，无名称输入框；Store 中只有路径数组无名称字段）
- [ ] **未做删除二次确认**（验证：点击删除按钮后立即移除，无 confirm 弹窗）
- [ ] **未做拖拽排序**（验证：无 `@dnd-kit` 依赖，行顺序按数组顺序，无拖拽手柄）
- [ ] **未做目录内容预览**（验证：行内只显示路径，无文件列表、无展开折叠）
- [ ] **未做批量导入导出**（验证：设置页无"导出配置"/"导入配置"按钮）
- [ ] **未做路径补全/建议**（验证：输入时不弹候选目录下拉列表）
- [ ] **未做主题切换等其他设置项**（验证：设置页只有"目录配置"一个卡片，无 Tab 切换、无主题选项）
- [ ] **未做配置项启用/禁用开关**（验证：行内无 Switch/Toggle 组件）
- [ ] **未引入非 Tauri 的新 npm 依赖**（验证：`package.json` 的 dependencies 仅新增三个 `@tauri-apps/plugin-*`，无 `@radix-ui/react-label` 等）

---

*本文档由 code-spec 技能辅助生成*
