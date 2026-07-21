# 设备管理重构（读取 yaml）Plan

## 一、架构概览

按"数据获取 → 解析 → 展示 → 交互"分层，复用现有目录配置链路。整体划分为四个层次：

| 层 | 职责 | 关键模块 |
| --- | --- | --- |
| 配置读取层 | 从应用设置取 `embedded-mcp-toolkit` 预置项路径 | 复用 `useDirectoryConfig` / `store.ts` |
| 设备数据层 | 读目录、解析 yaml、组装设备对象、容错 | `lib/devices.ts`（新建）+ `js-yaml` |
| 设备状态层 | 管理设备列表加载状态、刷新、当前详情 | `hooks/useDevices.ts`（新建） |
| 展示交互层 | 引导态、卡片列表、详情对话框、操作按钮 | `DevicesPage` 重写 + `DeviceCard` 重写 + `DeviceDetailDialog`（新建）+ `toast`/`dialog`（新建 ui） |

### 路由跳转的数据流

`App` 持有 `activeTab`（经 `useActiveTab`）。当前 `ContentArea` 仅接收 `activeTab` 用于渲染，不具备切换能力。为支持设备页"跳转设置页"，需让 `ContentArea` 透传 `onSwitch`（即 `setActiveTab`）到 `DevicesPage`，由 DevicesPage 的引导态按钮调用 `onSwitch("settings")`。

### 设备数据流

```
embedded-mcp-toolkit 路径（store.ts 读取）
        │
        ▼
lib/devices.ts: readDevices(basePath)
   ├─ 拼接 .embedded\configs\devices\
   ├─ readDir 列出 .yaml/.yml
   ├─ 逐文件 readTextFile + js-yaml.load
   ├─ 单文件失败 → 跳过 + console.warn
   └─ 返回 Device[]（含原始 yaml 文本，供复制/详情使用）
        │
        ▼
hooks/useDevices(): { status, devices, reload }
   ├─ status: 'no-path' | 'dir-missing' | 'loading' | 'ready' | 'error'
   └─ 进入页面调用一次 readDevices
        │
        ▼
DevicesPage 按 status 分流渲染
   ├─ no-path / dir-missing → 引导态
   └─ ready → DeviceCard 列表
```

## 二、核心数据结构

### Device（重建，替换现有 `types/device.ts`）

反映真实 yaml 结构，以通信通道为核心。

```ts
/** keyProvider 通用结构（ssh/serial 共用） */
interface KeyProvider {
  mode?: string;              // file | terminal
  challengeFilePath?: string;
  keyFilePath?: string;
  pollInterval?: number;
  timeout?: number;
}

/** SSH 通道（host 为 "none" 或整段缺失表示未启用） */
interface SshChannel {
  host?: string;              // "none" 表示未启用
  port?: number;              // 默认 22
  username?: string;
  password?: string;          // 敏感，列表脱敏
  keyProvider?: KeyProvider;
}

/** Serial 通道（port 为 "none" 或整段缺失表示未启用） */
interface SerialChannel {
  port?: string;              // "none" 表示未启用
  baudRate?: number;          // 默认 115200
  loginUsername?: string;
  loginPassword?: string;     // 敏感，列表脱敏
  keyProvider?: KeyProvider;
  uboot?: Record<string, unknown>;  // uboot 段本版不解析细节，原样保留
}

/** ADB 通道（serialNo 为 "sn_none" 或空表示未绑定） */
interface AdbChannel {
  serialNo?: string;          // "sn_none" 或空表示未绑定
}

/** 设备数据模型 */
interface Device {
  name: string;               // 文件名（去扩展名）
  ssh?: SshChannel;
  serial?: SerialChannel;
  adb?: AdbChannel;
  rawYaml: string;            // 原始文件文本，供复制与详情展示
}
```

### 设备加载状态（判别联合）

```ts
type DevicesStatus =
  | { kind: "loading" }
  | { kind: "no-path" }        // embedded-mcp-toolkit 路径为空
  | { kind: "dir-missing" }    // 路径已填但 devices 目录不存在
  | { kind: "ready"; devices: Device[] }
  | { kind: "error" };         // 读取异常
```

用 `kind` 判别联合，便于 UI 穷尽分支（替代 F1 中两种引导态 + ready 的分流）。

### 路径取用约定

`embedded-mcp-toolkit` 是预置项（`isPreset: true`），其 name 固定。数据层从 `useDirectoryConfig().items` 中按 `name === "embedded-mcp-toolkit" && isPreset` 取该项的 `path`。该匹配常量集中定义（见文件组织），避免散落字符串。

## 三、模块设计

### 模块 A：lib/devices.ts（新建）

**职责：** 设备数据读取与 yaml 解析的纯逻辑层，不依赖 React。

**对外接口：**
- `readDevices(basePath: string): Promise<DevicesResult>` —— 入参为 `embedded-mcp-toolkit` 的根路径（非 devices 子目录）。内部拼接 `.embedded\configs\devices\`，列目录、读文件、解析。返回 `{ status: DevicesStatus }` 或抛错由调用方处理。
- `isChannelEnabled` 系列判断函数（ssh: `host !== "none"`；serial: `port !== "none"`；adb: serialNo 非空且非 `sn_none`）——供卡片摘要与详情共用。

**依赖：** `@tauri-apps/plugin-fs`（readDir/readTextFile）、`js-yaml`、路径拼接工具（复用 `lib/path.ts` 或直接 `+`）。

**容错策略：** 单文件解析失败跳过并 `console.warn`；目录不存在返回 `dir-missing`；非 Tauri 环境返回 `error`（由调用方降级）。

### 模块 B：hooks/useDevices.ts（新建）

**职责：** 包装 `readDevices`，提供 React 友好的状态管理与刷新能力。

**对外接口：**
- `useDevices(): { status: DevicesStatus; reload: () => void }`
- 挂载时自动调用一次；`reload` 触发重新读取（后续章节刷新用，本版供复制后可选刷新）。

**依赖：** `lib/devices.ts`、`useDirectoryConfig`（取预置项路径）。

### 模块 C：DevicesPage（重写）

**职责：** 按 `status` 分流渲染：引导态 / 加载态 / 设备列表 / 错误态。

**变更：**
- 接收新 prop `onNavigateSettings: () => void`（由 ContentArea 透传，用于引导态跳转）
- 渲染逻辑：`status.kind` 穷尽 switch
- 列表区复用现有卡片"悬停淡入按钮"骨架，但内容按新 Device 模型
- 移除对 `MOCK_DEVICES` 的依赖

### 模块 D：DeviceCard（重写）

**职责：** 单张设备卡片，展示设备名 + 通道连接摘要，右侧四个操作按钮。

**变更：**
- props 改为 `{ device: Device; onDetail; onCopy; onEdit; onDelete }`
- 移除 `DeviceStatusBadge`、设备类型图标、ip/mac/os/configSummary
- 展示已启用通道摘要（SSH `user@host:port`、Serial `port@baudRate`、ADB 序列号）；password 脱敏 `·`
- 操作按钮统一橙色悬停（对齐 ch03 风格）

### 模块 E：DeviceDetailDialog（新建）

**职责：** 详情对话框，展示单设备完整配置。

**接口：** `{ device: Device | null; onClose: () => void }`（device 为 null 时不渲染）。

**展示：** 分通道区块（SSH / Serial / ADB）列出所有字段，密码明文展示（详情场景需核对完整配置）。直接渲染 `device.rawYaml` 为等宽文本块也是一种备选（更保真），见技术决策。

### 模块 F：ui/toast 与 ui/dialog（新建）

**职责：** 补齐项目缺失的基础交互组件。

- `ui/toast`：轻量全局提示（复制成功、占位提示）。采用最简实现（一个 toast 状态 + 渲染器），不引入 radix toast 等重依赖。提供 `useToast` hook 与 `<ToastContainer />`。
- `ui/dialog`：Modal 遮罩 + 居中面板。基于原生 `<dialog>` 或 div+fixed 遮罩实现，支持 ESC 关闭、点击遮罩关闭。供 DeviceDetailDialog 使用。

### 模块 G：剪贴板复制

**职责：** 复制 yaml 全文到系统剪贴板。

**决策：** 优先 `navigator.clipboard.writeText`（Tauri webview 支持，无需新增 Tauri 插件依赖）；失败时降级 `document.execCommand('copy')` 兜底。复制成功弹 toast。

## 四、模块交互

### 跳转设置页

```
DevicesPage（引导态按钮点击）
  → onNavigateSettings()
  → ContentArea 透传的 onSwitch("settings")
  → App.setActiveTab("settings")
  → useActiveTab 持久化 + ContentArea 重渲染为 SettingsPage
```

需改 App → ContentArea 增加 `onSwitch` 透传（ContentAreaProps 增加 `onSwitch`，传给 DevicesPage）。

### 详情对话框

```
DeviceCard 点「详情」
  → onDetail(device)
  → DevicesPage setDetailDevice(device)
  → DeviceDetailDialog 渲染（device 非 null）
  → 关闭：onClose → setDetailDevice(null)
```

### 复制

```
DeviceCard 点「复制」
  → onCopy(device)
  → DevicesPage handleCopy: navigator.clipboard.writeText(device.rawYaml)
  → 成功 → useToast.show("已复制 yaml 到剪贴板")
  → 失败 → useToast.show("复制失败", error)
```

## 五、文件组织

```
src/
├── components/
│   ├── DeviceCard.tsx              — 重写（通道摘要 + 四按钮）
│   ├── DeviceDetailDialog.tsx      — 新建（详情 Modal）
│   ├── DeviceStatusBadge.tsx       — 废弃删除（真实数据无状态概念）
│   └── ui/
│       ├── dialog.tsx              — 新建（Modal 基础组件）
│       └── toast.tsx               — 新建（轻量全局提示）
├── config/
│   ├── devices.ts                  — 改造：移除 MOCK_DEVICES/类型图标/状态样式，
│   │                                 保留通道摘要格式化等纯函数；新增 embedded-mcp-toolkit
│   │                                 预置项 name 常量与 devices 子目录相对路径常量
│   └── settings.ts                 — 不变（PRESET_DIRECTORY_ITEMS 已含目标项）
├── hooks/
│   ├── useDevices.ts               — 新建（设备列表加载状态 + reload）
│   └── useToast.ts                 — 新建（toast 状态管理，配合 ui/toast）
├── lib/
│   ├── devices.ts                  — 新建（readDevices + yaml 解析 + 通道启停判断）
│   └── clipboard.ts                — 新建（复制封装，含降级）
├── pages/
│   └── DevicesPage.tsx             — 重写（status 分流 + 引导态 + 列表 + 详情/复制编排）
├── types/
│   └── device.ts                   — 重写（Device/SshChannel/SerialChannel/AdbChannel）
├── components/ContentArea.tsx      — 改造：透传 onSwitch 给 DevicesPage
└── package.json                    — 新增 js-yaml + @types/js-yaml 依赖
```

## 六、技术决策

| 决策点 | 选择 | 理由 |
| --- | --- | --- |
| yaml 解析库 | js-yaml | 业界标准、生态成熟、体积可接受；用户已确认 |
| 详情展示形式 | 结构化字段区块 | 比纯 yaml 文本更易读；保留 rawYaml 作为复制源，详情用结构化 |
| 剪贴板方案 | navigator.clipboard 优先 + execCommand 兜底 | Tauri webview 支持，无需新增 Tauri 插件依赖 |
| toast/dialog 实现 | 自建轻量组件 | 现有 ui 目录无此类组件；自建避免引入 radix-dialog 等重依赖，符合项目"基础库沉淀"风格 |
| 路由跳转 | 透传 onSwitch 到 DevicesPage | 复用现有 activeTab 状态机制，不引入 react-router |
| 通道启停判断 | 约定值 none/sn_none/空 | 直接对齐真实 yaml 注释约定，无需额外配置 |
| DeviceStatusBadge | 删除 | 真实数据无在线状态概念，模型已重建，该组件无消费方 |

## 七、编码规范

**编程语言：** TypeScript（React 19 + Tauri 2）

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（ts-lang-spec 优先，以下为兜底）：**
- **新建文件**：UTF-8 无 BOM、LF 换行
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变；本项目历史提交已完成 CRLF→LF 统一，修改时保持 LF

开发阶段编写代码时，必须遵循 ts-lang-spec 中定义的编码风格、命名约定、注释规范（含文件头版权注释块、JSDoc、类型导出等）。开发执行者应在开始编码前自动调用 ts-lang-spec 技能，并严格遵守上述文件编码规则。
