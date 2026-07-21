<!-- more -->

# 设置页目录配置 Plan

## 一、架构概览

本章在补齐 Tauri 插件（dialog / fs / store）与基础 UI 组件（input / label）两项基础设施的前提下，实现设置页的目录配置功能。整体自下而上分四层：

```
┌─────────────────────────────────────────────────────────┐
│  Pages 层                                                │
│  SettingsPage.tsx  ← 从占位页改为目录配置页               │
│      │                                                   │
│      ├─ useDirectoryConfig hook（状态 + 异步持久化）      │
│      └─ 渲染 DirectoryItemRow 列表 + 添加按钮            │
│                                                          │
│  Components 层（业务组件 + UI 基础组件）                  │
│  DirectoryItemRow.tsx ← 单行（名称+输入框+按钮组+校验）   │
│  ui/input.tsx       ← shadcn Input（新增）               │
│  ui/label.tsx       ← shadcn Label（新增）               │
│  ui/button.tsx      ← 复用 ch02                          │
│  ui/card.tsx        ← 复用 ch02                          │
│                                                          │
│  Hooks 层                                                │
│  useDirectoryConfig.ts ← 列表状态 + 增删改 + Store 持久化 │
│  useDebouncedCheck.ts ← 路径存在性防抖校验                │
│                                                          │
│  Config / Lib 层                                         │
│  lib/store.ts       ← Store 单例封装（load + save）      │
│  config/settings.ts ← STORE_FILE / STORE_KEY 常量        │
└─────────────────────────────────────────────────────────┘
```

### 1.1 各模块职责

| 模块 | 职责 | 来源 |
|------|------|------|
| `SettingsPage` | 设置页主体，组装标题区 + 目录卡片，调用 `useDirectoryConfig` | 改造现有占位页 |
| `DirectoryItemRow` | 单个目录项的行视图（名称、输入框、按钮、校验提示） | 新增业务组件 |
| `useDirectoryConfig` | 列表状态管理 + 异步持久化到 Store | 新增 hook |
| `useDebouncedCheck` | 路径存在性校验的 debounce 封装 | 新增 hook |
| `lib/store` | Tauri Store 插件的单例封装（避免重复 load） | 新增工具 |
| `config/settings` | Store 文件名、键名等常量 | 新增配置 |
| `ui/input`、`ui/label` | shadcn 表单基础组件 | 新增 UI 组件 |

### 1.2 关键设计取舍

- **Store 单例封装**：Store 插件的 `load()` 返回的是单例（同一文件名多次 load 返回同一对象），但仍封装一层 `lib/store.ts` 统一管理文件名/键名/异常降级，避免业务层散落裸 `load()` 调用。
- **校验与持久化解耦**：路径校验（`useDebouncedCheck`）只管"显示红字"，不参与保存决策；持久化（`useDirectoryConfig`）只管"写入 Store"，不管路径是否有效。两者通过 props 在 `DirectoryItemRow` 内汇合。
- **异步加载用 useEffect**：Store API 是 Promise，hook 用 `useState(空) + useEffect(load)` 模式，加 `isLoading` 标志位驱动加载态 UI。

## 二、核心数据结构

### 2.1 DirectoryItem（目录项领域模型）

```ts
/** 目录项（仅运行时使用，不入库） */
export interface DirectoryItem {
  /** 前端唯一标识（用于 React key，不入库） */
  id: string;
  /** 目录路径（空字符串表示未填写） */
  path: string;
}
```

**关键决策：** `id` 不入库。Store 只存 `string[]`（路径数组），加载时重新生成 id（用 `crypto.randomUUID()`）。原因：
- 持久化数据最小化——只存用户关心的路径
- 避免 id 序列化/反序列化的版本兼容问题
- React key 只需在单次会话内稳定即可

### 2.1.1 持久化格式（Store 中的 JSON）

```json
{
  "directory-config": [
    "D:/projects/my-app",
    "E:/workspace/toolkit",
    ""
  ]
}
```

- 顶层 key：`directory-config`
- 值：`string[]`，每项为一个路径，空字符串允许（表示"新增但未填写"的项）
- 读取时校验：必须是数组、每项必须是字符串，否则回退到 `[]`

### 2.2 DirectoryValidation（校验状态）

```ts
/** 路径校验状态 */
export type DirectoryValidation =
  | { status: "idle" }          // 未校验（空路径或加载中）
  | { status: "checking" }      // 校验中（fs 调用进行中）
  | { status: "valid" }         // 目录存在
  | { status: "invalid" };      // 目录不存在或不可访问
```

使用判别联合（discriminated union）而非简单 boolean，便于 UI 区分"校验中"（可显示 spinner）与"未校验"（什么都不显示）。

### 2.3 Store 配置常量

```ts
/** Store 文件名（应用级所有设置统一存这一份） */
export const STORE_FILE = "settings.json";

/** 目录配置在 Store 中的键名 */
export const DIRECTORY_CONFIG_KEY = "directory-config";
```

`STORE_FILE` 命名为 `settings.json` 而非 `store.json`，语义更清晰；后续章节（主题切换、导入导出）的配置也写入此文件，按 key 区分（如 `theme`、`export-config`）。

## 三、模块设计

### 3.1 配置常量模块

**文件：** `src/config/settings.ts`
**职责：** 导出 `STORE_FILE` 与 `DIRECTORY_CONFIG_KEY` 两个常量。
**依赖：** 无。

### 3.2 Store 封装模块

**文件：** `src/lib/store.ts`
**职责：** 封装 Tauri Store 插件，提供 `loadStore()` / `readDirectoryConfig()` / `writeDirectoryConfig()` 三个函数。
**对外接口：**

```ts
/**
 * 加载 Store 单例（同一文件名多次调用返回同一实例）
 * @returns Store 实例
 */
export async function loadStore(): Promise<Store>;

/**
 * 读取目录配置
 * @returns 路径数组；读取失败或无数据返回空数组
 */
export async function readDirectoryConfig(): Promise<readonly string[]>;

/**
 * 写入目录配置（立即落盘）
 * @param paths - 路径数组
 */
export async function writeDirectoryConfig(paths: readonly string[]): Promise<void>;
```

**实现要点：**

- `loadStore()` 调用 `load(STORE_FILE, { autoSave: false })`，autoSave 关闭，手动控制落盘时机
- `readDirectoryConfig()` 读 `DIRECTORY_CONFIG_KEY`，做合法性校验（是数组且每项为字符串），异常或非法时返回 `[]`
- `writeDirectoryConfig()` 调 `store.set()` + `store.save()` 显式落盘，异常时静默降级（console.warn，不抛）
- 所有函数对非 Tauri 环境（纯浏览器 dev）优雅降级：检测 `window.__TAURI__` 是否存在，不存在时 `readDirectoryConfig` 返回 `[]`、`writeDirectoryConfig` 直接 return

**依赖：** `@tauri-apps/plugin-store`（`load`、`Store` 类型）、`@/config/settings`。

### 3.3 目录配置 Hook

**文件：** `src/hooks/useDirectoryConfig.ts`
**职责：** 管理目录列表状态 + 异步加载 + 增删改时持久化。
**对外接口：**

```ts
export interface UseDirectoryConfigResult {
  /** 目录项列表（含前端 id） */
  items: readonly DirectoryItem[];
  /** 是否正在加载初始数据 */
  isLoading: boolean;
  /** 新增一个空目录项（追加到末尾） */
  addItem: () => void;
  /** 删除指定 id 的目录项 */
  removeItem: (id: string) => void;
  /** 更新指定 id 的目录项路径 */
  updatePath: (id: string, path: string) => void;
}

export function useDirectoryConfig(): UseDirectoryConfigResult;
```

**内部状态：**

```ts
const [items, setItems] = useState<DirectoryItem[]>([]);
const [isLoading, setIsLoading] = useState(true);
```

**生命周期：**

- `useEffect(() => { load() }, [])`：首次挂载异步调用 `readDirectoryConfig()`，把 `string[]` 转为 `DirectoryItem[]`（每项生成 uuid），设置 items 并关闭 isLoading
- 每个 mutator（addItem / removeItem / updatePath）：先 `setItems` 更新内存，再异步调用 `writeDirectoryConfig(items.map(i => i.path))` 落盘。写失败静默降级

**Mutator 实现要点：**

- `addItem()`：`setItems(prev => [...prev, { id: crypto.randomUUID(), path: "" }])`
- `removeItem(id)`：`setItems(prev => prev.filter(i => i.id !== id))`
- `updatePath(id, path)`：`setItems(prev => prev.map(i => i.id === id ? { ...i, path } : i))`
- 三个 mutator 都用 `useCallback` 包裹，内部用函数式更新避免闭包陈旧值；写盘用最新的 items 派生（通过 `setItems` 的回调参数计算 paths）

**依赖：** `react`（`useState` / `useEffect` / `useCallback`）、`@/lib/store`、`@/types/settings`（`DirectoryItem`）。

### 3.4 路径校验 Hook

**文件：** `src/hooks/useDebouncedCheck.ts`
**职责：** 对输入路径做防抖的目录存在性校验，返回校验状态。
**对外接口：**

```ts
export function useDebouncedCheck(
  path: string,
  debounceMs?: number,  // 默认 400
): DirectoryValidation;
```

**实现要点：**

- 输入为空字符串时立即返回 `{ status: "idle" }`，不触发 fs 调用
- 用 `useRef` 存 timer、`useState` 存 `DirectoryValidation`，path 变化时 `useEffect` 启动 debounce timer
- debounce 到期后状态切到 `{ status: "checking" }`，调用 Tauri fs 的 `exists(path)` 校验
- 非 Tauri 环境直接返回 `{ status: "idle" }`，不调用 fs
- 组件卸载时 `clearTimeout` 避免内存泄漏与"卸载后 setState"告警

**依赖：** `@tauri-apps/plugin-fs`（`exists`）、`@/types/settings`（`DirectoryValidation`）。

### 3.5 单行目录项组件

**文件：** `src/components/DirectoryItemRow.tsx`
**职责：** 渲染一行目录项——名称 + 路径输入框 + 打开按钮 + 删除按钮 + 校验提示。
**对外接口：**

```ts
export interface DirectoryItemRowProps {
  /** 目录项数据 */
  item: DirectoryItem;
  /** 路径变化回调 */
  onPathChange: (id: string, path: string) => void;
  /** 删除回调 */
  onRemove: (id: string) => void;
  /** 打开目录选择器并填充路径的回调 */
  onPickDirectory: (id: string) => void;
  /** 是否自动聚焦（新增项传 true） */
  autoFocus?: boolean;
}
export function DirectoryItemRow(props: DirectoryItemRowProps): React.ReactElement;
```

**内部逻辑：**

- 派生名称：`const name = item.path ? basename(item.path) : "未命名"`，其中 `basename` 提取路径末尾段（按 `/` 和 `\` 分割取最后非空段）
- 调 `useDebouncedCheck(item.path)` 获取校验状态，驱动红字提示显隐
- 输入框 `onChange` 直接调 `onPathChange(item.id, e.target.value)`（即时保存由父组件处理）
- 校验状态为 `invalid` 时，输入框 `aria-invalid={true}`，下方红字通过 `aria-describedby` 关联

**渲染结构：**

```tsx
<div className="flex flex-col gap-1.5">
  {/* 主体行：名称 + 输入框 + 按钮组 */}
  <div className="flex items-center gap-2">
    {/* 名称（派生，只读展示） */}
    <span className="w-24 flex-shrink-0 text-sm text-muted-foreground truncate">{name}</span>

    {/* 路径输入框 */}
    <Input
      id={`dir-input-${item.id}`}
      value={item.path}
      onChange={(e) => onPathChange(item.id, e.target.value)}
      aria-invalid={validation.status === "invalid"}
      aria-describedby={validation.status === "invalid" ? `dir-error-${item.id}` : undefined}
      placeholder="请输入或选择目录路径"
      ref={autoFocus ? focusRef : undefined}
      className="flex-1"
    />

    {/* 打开目录按钮 */}
    <Button variant="outline" size="icon" aria-label="打开目录" onClick={() => onPickDirectory(item.id)}>
      <FolderOpen className="h-4 w-4" />
    </Button>

    {/* 删除按钮 */}
    <Button variant="ghost" size="icon" aria-label="删除目录" onClick={() => onRemove(item.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
  </div>

  {/* 校验提示（仅 invalid 时显示） */}
  {validation.status === "invalid" && (
    <p id={`dir-error-${item.id}`} className="text-xs text-red-600 dark:text-red-400 pl-[7.5rem]">
      目录不存在
    </p>
  )}
</div>
```

**依赖：** `lucide-react`（`FolderOpen`、`Trash2`）、`@/components/ui/input`、`@/components/ui/button`、`@/hooks/useDebouncedCheck`、`@/lib/utils`（`cn`）、`@/types/settings`。

### 3.6 设置页

**文件：** `src/pages/SettingsPage.tsx`（改造现有占位页）
**职责：** 组装标题区 + 目录卡片 + 加载态 + 空状态。
**内部状态：**

- 调 `useDirectoryConfig()` 拿 `items` / `isLoading` / `addItem` / `removeItem` / `updatePath`
- 定义 `handlePickDirectory(id)`：调用 `open({ directory: true, title: "选择目录" })`，选中后调 `updatePath(id, selected)`

**渲染结构：**

```tsx
<div className="space-y-6">
  {/* 标题区 */}
  <div>
    <h2 className="text-xl font-semibold">应用设置</h2>
    <p className="mt-1 text-sm text-muted-foreground">目录配置 · 管理应用关注的本地目录</p>
  </div>

  {/* 目录卡片 */}
  <Card>
    <CardHeader>
      <CardTitle>目录配置</CardTitle>
      <CardDescription>添加应用需要访问的本地目录路径</CardDescription>
    </CardHeader>

    <CardContent className="space-y-3">
      {/* 加载态 */}
      {isLoading && <LoadingPlaceholder />}

      {/* 列表 */}
      {!isLoading && items.map((item, index) => (
        <DirectoryItemRow
          key={item.id}
          item={item}
          autoFocus={index === items.length - 1 && item.path === "" /* 仅新增项聚焦 */}
          onPathChange={updatePath}
          onRemove={removeItem}
          onPickDirectory={handlePickDirectory}
        />
      ))}

      {/* 空状态 */}
      {!isLoading && items.length === 0 && <EmptyPlaceholder />}

      {/* 添加按钮 */}
      {!isLoading && (
        <Button variant="outline" onClick={addItem} className="w-full">
          <Plus className="h-4 w-4 mr-2" />添加目录
        </Button>
      )}
    </CardContent>
  </Card>
</div>
```

**加载态/空状态：**

- 加载态：`<div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>`（后续可换骨架屏）
- 空状态：`<div className="py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">暂无目录，点击下方添加</div>`

**依赖：** `react`、`@tauri-apps/plugin-dialog`（`open`）、`lucide-react`（`Plus`）、`@/components/ui/card`、`@/components/ui/button`、`@/components/DirectoryItemRow`、`@/hooks/useDirectoryConfig`。

### 3.7 UI 基础组件：Input

**文件：** `src/components/ui/input.tsx`
**职责：** shadcn 标准 Input（`React.forwardRef` + `cn`）。
**对外接口：**

```ts
export interface InputProps extends React.ComponentProps<"input"> {}
export const Input: React.ForwardRefExoticComponent<
  InputProps & React.RefAttributes<HTMLInputElement>
>;
```

**样式：** `flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`

**aria-invalid 处理：** 当 `aria-invalid={true}` 时叠加 `aria-[invalid=true]:border-red-500` 样式（红边框强化错误态）。

### 3.8 UI 基础组件：Label

**文件：** `src/components/ui/label.tsx`
**职责：** shadcn 标准 Label。
**对外接口：**

```ts
export interface LabelProps extends React.ComponentProps<"label"> {}
export const Label: React.ForwardRefExoticComponent<
  LabelProps & React.RefAttributes<HTMLLabelElement>
>;
```

**样式：** `text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`

**说明：** shadcn 官方 Label 实际基于 `@radix-ui/react-label`，但为避免引入新依赖（spec N2 约束），本章用原生 `<label>` + Tailwind 实现，去掉 peer-disabled 复杂逻辑（本场景不需要）。

### 3.9 Tauri 插件接入（四处同步）

| 文件 | 操作 | 内容 |
|------|------|------|
| `package.json` | `pnpm add` | `@tauri-apps/plugin-dialog` `@tauri-apps/plugin-fs` `@tauri-apps/plugin-store` |
| `src-tauri/Cargo.toml` | `cargo add` 或手编 | `tauri-plugin-dialog` `tauri-plugin-fs` `tauri-plugin-store`（均 version `"2"`） |
| `src-tauri/capabilities/default.json` | 手编 permissions 数组 | 追加 `"dialog:default"` `"fs:default"` `"store:default"` |
| `src-tauri/src/lib.rs` | 手编 Builder 链 | 追加三个 `.plugin(...)` 调用 |

**lib.rs 改造后：**

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**编码注意：** `package.json` / `Cargo.toml` / `tauri.conf.json` / `capabilities/default.json` / `lib.rs` 大概率是 CRLF 换行（ch01 plan 已记录）。修改时优先用 `pnpm add` / `cargo add`（自动保持换行符），capabilities 和 lib.rs 必须手编，编辑器不得擅自转 LF。

## 四、模块交互

### 4.1 加载时序

```
应用启动 → SettingsPage 挂载
  → useDirectoryConfig 内 useEffect 触发
  → readDirectoryConfig()
       → loadStore() (load "settings.json")
       → store.get("directory-config")
       → 合法性校验
       → 返回 string[]
  → 转为 DirectoryItem[] (生成 uuid)
  → setItems + setIsLoading(false)
  → 渲染 DirectoryItemRow × N
       → 每个 row 内 useDebouncedCheck(path) 启动校验
```

### 4.2 用户操作流

**手动输入路径：**

```
用户在 Input 键入字符
  → Input.onChange
  → onPathChange(id, newPath)
  → updatePath 更新 items 内存态
  → writeDirectoryConfig 异步落盘 (静默失败降级)
  → DirectoryItemRow 重渲染 (path 变化)
  → useDebouncedCheck 检测 path 变化
  → 启动 400ms debounce timer
  → 到期后 exists(path) 调用
  → 更新 validation 状态 → 红字显隐
```

**点击打开目录：**

```
用户点 "打开目录" 按钮
  → onPickDirectory(id) (SettingsPage 内)
  → open({ directory: true, title: "选择目录" })
  → 用户选择并确认 (或取消)
  → updatePath(id, selected) (确认时)
  → 触发与"手动输入"相同的保存 + 校验链路
```

**点击删除：**

```
用户点 "删除" 按钮
  → onRemove(id)
  → removeItem 过滤掉该 id
  → writeDirectoryConfig 落盘
  → 列表重渲染，该项消失
```

**点击添加：**

```
用户点 "添加目录" 按钮
  → addItem 追加 { id: uuid, path: "" }
  → writeDirectoryConfig 落盘 (数组多一个空字符串)
  → 列表重渲染，新项出现
  → autoFocus 使其 Input 获得焦点
```

## 五、文件组织

```
src/
├── components/
│   ├── ui/
│   │   ├── tooltip.tsx          [已有]
│   │   ├── button.tsx           [已有] ch02
│   │   ├── card.tsx             [已有] ch02
│   │   ├── input.tsx            [新增] shadcn Input
│   │   └── label.tsx            [新增] shadcn Label（原生 label 实现）
│   ├── DeviceCard.tsx           [已有] ch02
│   ├── DeviceStatusBadge.tsx    [已有] ch02
│   └── DirectoryItemRow.tsx     [新增] 目录项单行组件
├── config/
│   ├── constants.ts             [已有] ch01
│   ├── nav.ts                   [已有] ch01
│   ├── devices.ts               [已有] ch02
│   └── settings.ts              [新增] STORE_FILE / DIRECTORY_CONFIG_KEY
├── hooks/
│   ├── useActiveTab.ts          [已有] ch01
│   ├── useDirectoryConfig.ts    [新增] 列表状态 + 异步持久化
│   └── useDebouncedCheck.ts     [新增] 路径校验防抖
├── lib/
│   ├── utils.ts                 [已有] cn
│   └── store.ts                 [新增] Tauri Store 单例封装
├── pages/
│   └── SettingsPage.tsx         [修改] 从占位页改为目录配置页
├── types/
│   ├── device.ts                [已有] ch02
│   └── settings.ts              [新增] DirectoryItem / DirectoryValidation
└── ...

src-tauri/
├── Cargo.toml                   [修改] 加三个 plugin 依赖
├── capabilities/
│   └── default.json             [修改] permissions 追加三项
└── src/
    └── lib.rs                   [修改] Builder 链注册三个插件
```

## 六、技术决策

| 编号 | 决策点 | 选择 | 理由 |
|------|--------|------|------|
| D1 | 持久化方案 | **Tauri Store 插件** | 用户选定的方案。数据存为应用 cache 目录的真实 JSON 文件，用户可见可备份可迁移，比 localStorage 更符合"配置数据"语义。 |
| D2 | Store 文件命名 | **`settings.json`** | 应用级所有设置统一存这一份，后续章节（主题切换、导入导出）按 key 复用，避免散落多个 Store 文件。 |
| D3 | autoSave 策略 | **`autoSave: false` + 手动 `save()`** | 显式控制落盘时机，避免内存态与磁盘态不一致的调试困惑（[Issue #1102](https://github.com/tauri-apps/plugins-workspace/issues/1102) 记录过相关坑）。 |
| D4 | 目录项 id 是否入库 | **不入库** | Store 只存 `string[]`（路径数组），加载时用 `crypto.randomUUID()` 重新生成 id。持久化数据最小化，避免 id 版本兼容问题，React key 只需会话内稳定。 |
| D5 | 校验与持久化是否耦合 | **解耦** | 校验（`useDebouncedCheck`）只管显示红字，不参与保存决策；持久化（`useDirectoryConfig`）只管写入。spec F5 明确"校验失败不阻断保存"，解耦后职责清晰。 |
| D6 | 校验 debounce 时长 | **400ms** | 平衡响应感（用户停顿后尽快反馈）与性能（避免逐字符 fs 调用）。常见值 300-500ms，取中。 |
| D7 | Label 是否用 @radix-ui/react-label | **不用，原生 label** | spec N2 约束"UI 层不引入新 npm 依赖"。本场景 Label 不需要 Radix 的高级特性（peer-disabled 自动联动等），原生 `<label>` 足够。 |
| D8 | 名称提取规则 | **按 `/` 和 `\` 分割取最后非空段** | 跨平台兼容（Windows 用 `\`，Unix 用 `/`），路径末尾段作为目录名符合直觉。空路径显示"未命名"。 |
| D9 | 加载态处理 | **`isLoading` 标志位 + 文字提示** | Store API 异步，加载期不能显示空列表（避免"配置丢失"误解）。本章节用最简文字提示，后续可升级骨架屏。 |
| D10 | 非 Tauri 环境降级 | **检测 `window.__TAURI__` 存在性** | 纯浏览器 dev（如 `pnpm dev` 不走 tauri）调用插件 API 会抛错。在 `lib/store.ts` 与 `useDebouncedCheck.ts` 入口处统一降级：read 返 `[]`、write/check 直接 return。 |
| D11 | 新增项的自动聚焦策略 | **仅最后一项且 path 为空时 autoFocus** | 避免每次重渲染都把焦点抢到最后一项；只在 addItem 触发的新项上聚焦，用户手动编辑过的项不会突然抢焦。 |
| D12 | fs 校验 API 选择 | **`exists(path)`** | Tauri fs 插件提供 `exists`，比 `readDir` 后判空更轻量。不区分文件/目录（目录存在即视为有效，简化逻辑）。 |

## 七、编码规范

**编程语言：** TypeScript / TSX（React 19 + Tailwind v4 + Tauri v2）；Rust（仅 `src-tauri/src/lib.rs` 微改）

**适用的语言规范技能：** `ts-lang-spec`（开发执行者在开始编码前必须自动调用此技能）

**文件编码规则（ts-lang-spec 优先，以下为兜底）：**

- **新建文件**：UTF-8 无 BOM、LF 换行、文件末尾保留一个空行
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变。本章涉及的多个配置文件（`package.json` / `Cargo.toml` / `tauri.conf.json` / `capabilities/default.json` / `lib.rs`）大概率是 **CRLF**——优先用 `pnpm add` / `cargo add` 操作依赖文件，capabilities 和 lib.rs 手编时编辑器不得擅自转 LF

**项目特定规范（来自 ch01/ch02 plan + 现有代码实证）：**

- **文件头版权注释**：所有新建 `.ts` / `.tsx` 文件必须带 sumu 版权头（格式见 ch01 plan.md 第七章）
- **组件声明**：业务组件用 `function` 声明（`DirectoryItemRow`、`SettingsPage`）；UI 基础组件用 `React.forwardRef`（`Input`、`Label`）；均显式标注返回类型
- **Props 接口命名**：`<组件名>Props`，每个字段加 JSDoc
- **导入顺序**：第三方库 → `@/` 别名（`import type` 单独一行）→ 相对路径，组间空行
- **常量**：全大写 SNAKE_CASE（`STORE_FILE`、`DIRECTORY_CONFIG_KEY`）
- **判别联合**：`DirectoryValidation` 用 `"idle" | "checking" | "valid" | "invalid"` 的 status 字段区分，便于穷尽性检查
- **异步处理**：Store/fs 操作一律 `async/await`，异常用 `try/catch` 静默降级（不抛到 UI 层）
- **`cn()` 工具**：所有条件化 className 经 `cn()` 合并
- **暗色模式**：所有自定义颜色写 `dark:` 变体

---

*本文档由 code-spec 技能辅助生成*
