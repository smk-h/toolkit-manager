# 新增设备配置功能 Plan

## 架构概览

在现有设备管理架构上新增三个模块，复用 ch05 的 YAML 字段替换能力与编辑表单布局：

```
App ──→ Header(activeTab) ──→ 「新增设备」按钮（仅 devices tab 渲染）
                                  │ onClick 回调
                                  ▼
DevicesPage（统筹新增流程）
    ├── DeviceCreateDialog    ← 新建：名称输入 → 校验 → 配置 → 保存
    ├── useDevices().reload() ← 已有：创建成功后刷新列表
    └── lib/devices.ts        ← 扩充：新增 createDeviceFromTemplate()
```

- **App** 把已持有的 `activeTab` 透传给 `Header`，Header 据此决定是否渲染按钮
- **DevicesPage** 承接新增按钮事件，管理 CreateDialog 的 open/close 状态
- **DeviceCreateDialog** 两阶段对话框：阶段一设备名输入 + 实时校验；阶段二配置界面（复用编辑表单字段布局），保存时调用 `createDeviceFromTemplate()`
- **lib/devices.ts** 新增一个纯文件操作函数，复用 ch05 的 `parseYamlLines` / `replaceYamlFieldValue` 做模板文本级字段替换

## 核心数据结构

### 设备名校验结果

```typescript
/** 设备名校验结果（判别联合） */
type DeviceNameValidation =
  | { valid: true }                      // 校验通过
  | { valid: false; reason: string };    // 校验失败，附原因文案
```

### 模板设备

```typescript
/** 从 board-example.yaml 解析出的模板设备（用于配置界面预填） */
interface TemplateDevice {
  device: Device;        // 模板解析为 Device 对象（预填用）
  rawText: string;       // 模板原始文本（保存时做字段替换的基础）
}
```

### 通道字段定义（复用编辑 Dialog）

```typescript
/** 配置界面一个受控字段的配置（与 DeviceEditDialog 同构） */
interface FormField {
  path: string;                            // 点分路径 Key，如 "ssh.port"
  label: string;                           // 显示标签
  type: "text" | "number" | "password";    // 输入类型
}
```

## 模块设计

### 模块 1：lib/devices.ts — 新增「创建」能力

**职责：** 在现有读写函数基础上，新增一个从模板创建设备的函数。

**对外接口：**

```typescript
/**
 * 从模板创建新设备
 *
 * 1. 读取模板 board-example.yaml 的原始文本
 * 2. 将用户在配置界面修改的字段做文本级替换（复用 parseYamlLines / replaceYamlFieldValue）
 * 3. 将替换后的文本写入 <devicesDir>/<name>.yaml
 *
 * 模板缺失或解析失败时抛错，由调用方捕获后 toast 提示。
 *
 * @param devicesDir - 设备目录完整路径
 * @param name - 新设备名（已通过校验，无非法字符、无重名）
 * @param fieldUpdates - 用户修改的字段点分路径 → 新值映射（未修改字段不传入）
 * @returns 新设备的完整文件路径
 */
export async function createDeviceFromTemplate(
  devicesDir: string,
  name: string,
  fieldUpdates: Record<string, string | number | undefined>,
): Promise<string>;
```

**创建算法（复用 ch05 文本替换）：**

```
1. templatePath = `${devicesDir}/board-example.yaml`
2. templateText = readTextFile(templatePath)    // 读失败抛错 → F5 降级
3. 若 fieldUpdates 非空：
   a. lines = templateText.split('\n')
   b. index = parseYamlLines(templateText)
   c. 对每处 (path, newValue)：查找行索引，replaceYamlFieldValue 替换
   d. newText = lines.join('\n')
   否则 newText = templateText（用户未改任何字段，直接拷贝模板）
4. targetPath = `${devicesDir}/${name}.yaml`
5. writeTextFile(targetPath, newText)            // 写失败抛错 → F8 toast
6. return targetPath
```

**依赖：** `readTextFile`, `writeTextFile` from `@tauri-apps/plugin-fs`（已在 ch05 引入）；`parseYamlLines`, `replaceYamlFieldValue`（ch05 已实现）

### 模块 2：src/config/devices.ts — 新增校验常量与函数

**职责：** 提供设备名校验所需的常量与纯函数。

**对外接口：**

```typescript
/** 文件名非法字符集合（跨平台取并集） */
export const INVALID_NAME_CHARS = ["/", "\\", ":", "*", "?", '"', "<", ">", "|"] as const;

/** 模板文件名（固定，不可改） */
export const TEMPLATE_FILE_NAME = "board-example" as const;

/**
 * 校验设备名是否合法
 *
 * 顺序检查：空 → 非法字符 → 重名。
 *
 * @param name - 待校验设备名
 * @param existingNames - 现有设备名集合（用于重名检测）
 * @returns 校验结果（判别联合）
 */
export function validateDeviceName(
  name: string,
  existingNames: readonly string[],
): DeviceNameValidation;
```

**校验文案（与 F2 对齐）：**
- 空：`"请输入设备名"`
- 非法字符：`"设备名不能包含特殊字符：/ \\ : * ? \" < > |"`
- 重名：`` `设备名「${name}」已存在` ``

### 模块 3：src/components/DeviceCreateDialog.tsx — 新建

**职责：** 两阶段新增设备对话框。阶段一输入设备名 + 实时校验；阶段二配置界面 + 保存。

**对外接口：**

```typescript
export interface DeviceCreateDialogProps {
  /** 现有设备名列表（用于重名校验） */
  existingNames: readonly string[];
  /** 设备目录完整路径（保存时拼目标文件路径） */
  devicesDir: string;
  /** 是否打开（null 时关闭） */
  open: boolean;
  /** 关闭/取消回调 */
  onClose: () => void;
  /** 创建成功回调（触发列表刷新 + toast） */
  onCreated: (deviceName: string) => void;
}
```

**内部状态：**

```typescript
type Stage = "name" | "config";   // 当前阶段
const [stage, setStage] = useState<Stage>("name");
const [name, setName] = useState("");                 // 设备名输入值
const [touched, setTouched] = useState(false);        // 是否触发过校验（控制首次空值是否报错）
const [template, setTemplate] = useState<TemplateDevice | null>(null);  // 模板数据
const [loadingTemplate, setLoadingTemplate] = useState(false);
const [values, setValues] = useState<Record<string, string>>({});       // 配置表单值
const [saving, setSaving] = useState(false);
```

**阶段一：设备名输入**

```
- 输入框 onChange：
    setName(value); setTouched(true);
- 实时校验：
    const result = validateDeviceName(name, existingNames);
    if (!result.valid) → 输入框标红 + 显示 result.reason
- 「下一步」按钮：仅当 result.valid 为 true 时可点击
- 点击「下一步」：
    进入阶段二前先加载模板（loadingTemplate = true）
    读取 board-example.yaml 文本 + 解析为 Device → 填充 values + template
    模板读取失败 → toast(F5 文案) + 保持阶段一、不切阶段
    成功 → setStage("config")
```

**阶段二：配置界面**

```
- 复用 DeviceEditDialog 的三区块字段组定义（SSH / Serial / ADB）
- 与编辑 Dialog 的差异：
  · 预填值来自模板（board-example.yaml 的解析值），而非现有设备
  · 密码脱敏逻辑一致（· 占位、聚焦清空、可修改）
  · 不需要 dirtyFields 跟踪：用户改过的字段直接记入 values，
    保存时把所有值与模板原值比对，仅把「与模板不同的」字段作为 fieldUpdates
- 标题：「配置新设备 · {name}」
- 「上一步」按钮：回到阶段一（保留已输入名称与已修改配置）
- 「保存」按钮：
    1. 构建 fieldUpdates：遍历配置界面的全部字段，值与模板原值不同的才纳入
    2. 调用 createDeviceFromTemplate(devicesDir, name, fieldUpdates)
    3. 成功 → onCreated(name) → DevicesPage 刷新 + toast(F7 文案)
    4. 失败 → toast(F8 文案)，Dialog 不关闭
```

**关闭/取消行为（F6）：**
- 任意阶段点击「取消」、X、ESC、遮罩 → 重置全部内部状态（stage、name、values、template）并调用 `onClose`
- 不执行任何文件写入

**依赖：** `createDeviceFromTemplate`, `parseDevice`(内部) from `@/lib/devices`；`validateDeviceName`, `INVALID_NAME_CHARS` from `@/config/devices`；`Dialog`, `useToast`

### 模块 4：src/components/Header.tsx — 改造

**职责：** 从纯展示组件改为接收 `activeTab`，并在设备 tab 渲染新增按钮。

**对外接口扩展：**

```typescript
export interface HeaderProps {
  /** 当前激活的标签（决定是否渲染新增设备按钮） */
  activeTab: TabId;
  /** 新增设备点击回调（仅 devices tab 可触发） */
  onAddDevice: () => void;
}
```

**改造点：**

```
原：<Header />                                    // 无 props
新：<Header activeTab={activeTab} onAddDevice={...} />

渲染逻辑：
  右侧预留区 → {activeTab === "devices" && (
    <Button variant="ghost" size="sm"
            className="hover:bg-orange-500 hover:text-white"
            onClick={onAddDevice}>
      <Plus /> 新增设备
    </Button>
  )}
  其余 tab：右侧区不渲染任何内容（满足 N5）
```

**按钮样式**：采用 `ghost` variant（默认透明背景），悬浮时橙色高亮（`hover:bg-orange-500 hover:text-white`），与 DeviceCard 上「详情/复制/编辑/删除」四个操作按钮的视觉风格保持一致。

### 模块 5：src/App.tsx — 改造

**职责：** 把新增流程的事件从 Header 串到 DevicesPage。

**问题：** Header 和 DevicesPage 是 App 下的兄弟组件，ContentArea 用 framer-motion 按 activeTab 切换页面。Header 按钮事件需要触发 DevicesPage 内的 Dialog 打开。

**方案：在 App 持有 `createOpen` 状态，下传给两侧。**

```typescript
// App.tsx 新增状态
const [createOpen, setCreateOpen] = useState(false);

// Header：点击按钮 → setCreateOpen(true)
<Header activeTab={activeTab} onAddDevice={() => setCreateOpen(true)} />

// ContentArea → DevicesPage：接收 createOpen 与开关回调
<ContentArea
  activeTab={activeTab}
  onSwitch={setActiveTab}
  createOpen={createOpen}
  onCreateClose={() => setCreateOpen(false)}
/>
```

> 说明：DeviceCreateDialog 放在 DevicesPage 内渲染（它需要 `existingNames` / `devicesDir` / `reload`，这些都由 DevicesPage 的 `useDevices` 提供），由 App 的 `createOpen` 作为受控开关。DevicesPage 新增 `createOpen` / `onCreateClose` 两个 props。

### 模块 6：src/components/ContentArea.tsx — 改造

**职责：** 透传新增相关的 props 到 DevicesPage。

```typescript
export interface ContentAreaProps {
  activeTab: TabId;
  onSwitch: (tab: TabId) => void;
  createOpen: boolean;                  // ← 新增
  onCreateClose: () => void;            // ← 新增
}

// renderPage 的 devices 分支：
<DevicesPage
  onNavigateSettings={() => onSwitch("settings")}
  createOpen={createOpen}
  onCreateClose={onCreateClose}
/>
```

### 模块 7：src/pages/DevicesPage.tsx — 改造

**职责：** 渲染 CreateDialog，提供 `existingNames` / `devicesDir`，处理创建成功回调。

**Props 扩展：**

```typescript
export interface DevicesPageProps {
  onNavigateSettings: () => void;
  createOpen: boolean;          // ← 新增：受控开关
  onCreateClose: () => void;    // ← 新增
}
```

**新增逻辑：**

```
- 从 useDevices 解构 status, reload
- 计算 existingNames：status.kind === "ready" ? status.devices.map(d => d.name) : []
- 计算 devicesDir：从 useDirectoryConfig 取 presetItem.path + DEVICES_SUBDIR 拼接
  （与 lib/devices.ts readDevices 的拼接逻辑一致）
- handleCreated(name):
    reload()
    show(`设备「${name}」已创建`, "success")
    onCreateClose()
- 渲染：
    <DeviceCreateDialog
      existingNames={existingNames}
      devicesDir={devicesDir}
      open={createOpen}
      onClose={onCreateClose}
      onCreated={handleCreated}
    />
```

> `devicesDir` 的获取：DevicesPage 现有逻辑只用了 `useDevices`。为拿到 presetItem.path，需引入 `useDirectoryConfig`（与 useDevices 内部一致），或从 useDevices 暴露 basePath。**决策见下「技术决策」。**

## 模块交互

```
用户在设备页点击 Header 的「新增设备」
  → App.setCreateOpen(true)
  → ContentArea 透传 createOpen 给 DevicesPage
  → DeviceCreateDialog 打开（阶段一：名称输入）

阶段一：
  用户输入设备名
  → validateDeviceName(name, existingNames) 实时校验
  → 校验失败：标红 + 文案；通过：「下一步」可点
  → 点击「下一步」
  → DeviceCreateDialog 读取 board-example.yaml + 解析
    → 失败：toast(F5) + 保持阶段一
    → 成功：setStage("config")，预填模板值

阶段二：
  用户修改字段（可选）
  → 点击「保存」
  → 构建 fieldUpdates（仅与模板原值不同的字段）
  → createDeviceFromTemplate(devicesDir, name, fieldUpdates)
    → 读模板 → 文本替换 → 写入 <name>.yaml
  → 成功：onCreated(name)
    → DevicesPage.reload() + toast(F7) + onCreateClose()
    → Dialog 关闭、列表刷新出现新设备
  → 失败：toast(F8)，Dialog 不关闭

任意阶段取消/X/ESC：
  → 重置内部状态 + onClose → onCreateClose()
  → 不创建任何文件
```

## 文件组织

```
src/
├── lib/
│   └── devices.ts              ← 修改：新增 createDeviceFromTemplate()
├── config/
│   └── devices.ts              ← 修改：新增 INVALID_NAME_CHARS / TEMPLATE_FILE_NAME / validateDeviceName()
├── components/
│   ├── DeviceCreateDialog.tsx  ← 新建：两阶段新增对话框
│   ├── DeviceEditDialog.tsx    ← 不变（配置界面字段组定义可参考复用）
│   ├── Header.tsx              ← 修改：接收 activeTab，渲染新增按钮
│   └── ContentArea.tsx         ← 修改：透传 createOpen/onCreateClose
├── pages/
│   └── DevicesPage.tsx         ← 修改：渲染 CreateDialog，提供 existingNames/devicesDir
├── App.tsx                     ← 修改：持有 createOpen 状态，串联 Header 与 DevicesPage
└── types/
    └── device.ts               ← 不变（Device 类型已含 filePath，无新增字段）
src-tauri/
└── capabilities/
    └── default.json            ← 不变（fs:allow-write-text-file / fs:scope 已在 ch05 配齐）
```

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 按钮位置 | 全局 Header + 仅 devices tab 渲染 | 用户明确要求；activeTab 已在 App 持有，透传 Header 即可 |
| 按钮样式 | ghost variant + 悬浮橙色高亮 | 用户明确要求默认与其他操作按钮风格一致；与 DeviceCard 详情/复制/编辑/删除四按钮的 ghost + `hover:bg-orange-500 hover:text-white` 完全对齐，视觉统一 |
| Header↔DevicesPage 通信 | App 持有 createOpen 状态下传两侧 | Header 与 DevicesPage 是兄弟组件，状态上提到共同父级 App 最直接；无需引入 Context/全局 store |
| 配置界面 | 复用编辑 Dialog 的字段布局，新建独立 CreateDialog 组件 | 字段渲染相同但流程不同（两阶段、预填模板、保存逻辑不同）；独立组件比让 EditDialog 兼容"新建模式"更清晰 |
| 模板来源 | 运行时读取本地 board-example.yaml | 用户明确选择；单一数据源，用户对模板的修改自动生效 |
| 新文件内容生成 | 模板原文 + 字段级替换（复用 ch05 工具） | 满足 N1（保留注释/格式）；ch05 的 parseYamlLines/replaceYamlFieldValue 已可直接复用 |
| 设备目录路径获取 | DevicesPage 直接引入 useDirectoryConfig 取 presetItem.path | 复用现有 hook，不污染 useDevices 的返回值；拼接逻辑与 lib/devices.ts 保持一致 |
| 保存时 fieldUpdates 构建 | 遍历配置字段，仅纳入与模板原值不同的 | 避免把模板原值再次"替换为相同值"的无意义写入；与 ch05 幂等思路同源 |
| 阶段二密码脱敏 | 与 EditDialog 完全一致（· 占位/聚焦清空/可改） | N2 要求；行为一致性，降低用户认知负担 |
| 模板读取时机 | 点击「下一步」时按需读取（非打开 Dialog 即读） | 阶段一不需要模板；按需读取避免无谓 IO，且失败点明确（仅切阶段时） |
| 关闭时状态重置 | 重置 stage/name/values/template | 避免下次打开残留上次输入；取消保护 F6 |

## 编码规范

**编程语言：** TypeScript

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（语言规范技能优先，以下为兜底）：**
- **新建文件**：UTF-8 无 BOM、LF 换行。
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变（如原为 GB2312/GBK 则仍按原编码写回，绝不转换）。
