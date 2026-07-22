# 设备编辑与删除功能 Plan

## 架构概览

在现有只读架构上新增三个模块：

```
DevicesPage（统筹编辑/删除流程）
    ├── DeviceEditDialog      ← 新建：编辑配置对话框
    ├── DeviceDeleteDialog    ← 新建：删除确认对话框
    ├── useDevices().reload() ← 已有：编辑/删除后刷新列表
    └── lib/devices.ts        ← 扩充：新增 updateDeviceYaml() / trashDeviceFile()
```

- **DevicesPage** 承接编辑/删除按钮事件，管理编辑/删除 Dialog 的 open/close 状态
- **DeviceEditDialog** 接收设备对象，渲染可编辑表单，保存时调用 `updateDeviceYaml()` 做文本级 YAML 字段替换
- **DeviceDeleteDialog** 展示确认文案，确认后调用 `trashDeviceFile()` 将文件移入 OS 回收站
- **lib/devices.ts** 新增两个纯文件操作函数，不依赖 React

## 核心数据结构

### Device 类型扩展

```typescript
// types/device.ts — 新增 filePath 字段
export interface Device {
  name: string;              // 设备名（文件名去扩展名）
  filePath: string;          // ← 新增：YAML 文件完整路径
  ssh?: SshChannel;
  serial?: SerialChannel;
  adb?: AdbChannel;
  rawYaml: string;
}
```

### 字段更新描述

```typescript
/** 单字段更新的 path → newValue 映射 */
type FieldUpdates = Record<string, string | number | undefined>;
// key 为点分路径，如 "ssh.password"、"serial.port"
// value 为 undefined 表示删除该字段
```

### YAML 行信息

```typescript
/** YAML 文件中一行文本的解析结果 */
interface YamlLineEntry {
  path: string[];      // 累积点分路径，如 ["ssh", "password"]
  lineIndex: number;   // 0-based 行号
  indent: number;      // 前导空格数
  key: string;         // 行中冒号前的 key 名
  valueRaw: string;    // 冒号后的原始文本（含引号、尾随空格）
  valueStart: number;  // 值内容在 rawLine 中的起始字符偏移
}
```

## 模块设计

### 模块 1：lib/devices.ts — 新增「写入」能力

**职责：** 在现有只读函数基础上，新增两个写入函数。

**对外接口：**

```typescript
/**
 * 编辑保存：以文本级字段替换方式更新 YAML 文件
 *
 * 1. 读取原始 YAML 文本
 * 2. 用 parseYamlLines() 构建行索引
 * 3. 对每处变更调用 replaceYamlField() 做文本替换
 * 4. 将修改后的文本写回原文件
 *
 * @param filePath - YAML 文件完整路径
 * @param updates - 点分路径 → 新值的映射
 * @param origRawYaml - 原始 YAML 文本（用于比对不变内容）
 * @returns 修改后的 YAML 文本（调用方可选用于更新 rawYaml）
 */
export async function updateDeviceYaml(
  filePath: string,
  updates: Record<string, string | number | undefined>,
): Promise<string>;

/**
 * 删除设备：将 YAML 文件移入 OS 回收站
 *
 * @param filePath - YAML 文件完整路径
 */
export async function trashDeviceFile(filePath: string): Promise<void>;

/**
 * 解析 YAML 文本为行索引列表
 *
 * 逐行扫描，跟踪缩进级别来构建每个 scalar 字段的点分路径。
 *
 * @param yamlText - 原始 YAML 文本
 * @returns 行索引列表（仅含 key: value 的 scalar 行）
 */
export function parseYamlLines(yamlText: string): YamlLineEntry[];

/**
 * 对单行 YAML 文本做值替换
 *
 * @param rawLine - 原始行文本
 * @param newValue - 新值（将 toString）
 * @returns 替换后的行文本
 */
export function replaceYamlFieldValue(
  rawLine: string,
  newValue: string | number | undefined,
): string;
```

**YAML 文本替换算法：**

```
1. 读取原始 YAML 文本 lines[]
2. 逐行扫描，构建 (path → lineIndex) 索引：
   - 维护当前缩进栈 indentStack = [{path: [], indent: -1}]
   - 每行计算前导空格数
   - 若缩进 > 栈顶缩进，压栈（进入子对象）
   - 若缩进 <= 栈顶缩进，弹栈直到缩进匹配（回到父级）
   - 对 scalar 行（key: value），记录 lineIndex 与完整点分路径
3. 对 updates 中每个 (path, newValue)：
   a. 通过索引找到目标行 lineIndex
   b. 调用 replaceYamlFieldValue(lines[lineIndex], newValue)
   c. 替换 lines[lineIndex]
4. 忽略值实际未变的字段（防不必要的写操作）
5. 用 lines.join('\n') 重组文本，写回文件
```

**值替换规则：**
- 字符串值：保留原有引号风格（无引号/单引号/双引号）
  - 原值无引号 → 新值也去引号（特殊字符自动转义或加引号兜底）
  - 原值有引号 → 新值保留同种引号
- 数值：直接替换数字部分
- undefined：整行替换为空字符串（删除字段）

**依赖：** `writeTextFile`, `trash` from `@tauri-apps/plugin-fs`

### 模块 2：src/components/DeviceEditDialog.tsx — 新建

**职责：** 编辑设备配置的 Dialog，按通道分组展示可编辑字段。

**对外接口：**

```typescript
export interface DeviceEditDialogProps {
  device: Device;               // 待编辑的设备
  open: boolean;
  onClose: () => void;          // 关闭回调（取消）
  onSaved: (device: Device) => void;  // 保存成功回调（触发列表刷新 + toast）
}
```

**内部状态：**
- 各字段的受控值（以 `Record<string, string | number>` 存储，key 为点分路径）
- 脏标记（`dirtyFields: Set<string>`，跟踪哪些字段被修改过）
- 保存中 loading 状态

**密码脱敏处理：**
- 打开 Dialog 时，密码字段初始值用 `MASKED_VALUE` 按长度占位
- 用户聚焦密码输入框时，清空占位符，等待用户输入
- 若用户离开时未输入（仍为空），恢复原占位符
- 若用户输入了新值，记录为新值

**表单布局：**
- 复用详情 Dialog 的三区块布局（SSH / Serial / ADB）
- 每个字段渲染对应的输入控件：
  - `password` / `loginPassword` → `<input type="password">`
  - `port` / `baudRate` → `<input type="number">`
  - 其余字符串 → `<input type="text">`
  - `keyProvider` 下字段 → 统一 `<input type="text">`
- 底部「取消」「保存」按钮

**保存流程：**
1. 收集 dirtyFields 中字段的新值，构建 `FieldUpdates`
2. 调用 `updateDeviceYaml(device.filePath, updates)`
3. 成功后调用 `onSaved()` → DevicesPage 刷新列表 + toast 提示
4. 失败时 toast 错误，Dialog 不关闭

**依赖：** `updateDeviceYaml` from `@/lib/devices`

### 模块 3：src/components/DeviceDeleteDialog.tsx — 新建

**职责：** 删除确认 Dialog。

**对外接口：**

```typescript
export interface DeviceDeleteDialogProps {
  device: Device;               // 待删除的设备
  open: boolean;
  onClose: () => void;          // 关闭/取消回调
  onDeleted: () => void;        // 删除成功回调
}
```

**交互：**
- 标题："删除设备"
- 正文：`确定要将「{设备名}」移入回收站吗？`
- 底部「取消」「确定删除」按钮（确定删除按钮为红色危险样式）
- 删除中 loading 状态

**删除流程：**
1. 调用 `trashDeviceFile(device.filePath)`
2. 成功后调用 `onDeleted()` → toast "已移入回收站" + 刷新列表
3. 失败时 toast 错误

**依赖：** `trashDeviceFile` from `@/lib/devices`

### 模块 4：src/pages/DevicesPage.tsx — 改造

**职责：** 从桩函数改为实际的 Dialog 编排。

**新增状态：**
```typescript
const [editDevice, setEditDevice] = useState<Device | null>(null);
const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);
```

**改造点：**

```
handleEdit(device)  → setEditDevice(device)        // 打开编辑 Dialog
handleDelete(device)→ setDeleteDevice(device)       // 打开删除 Dialog
handleEditSaved()   → reload() + toast + setEditDevice(null)
handleDeleteDone()  → reload() + toast + setDeleteDevice(null)
```

**新增 JSX：**
```tsx
<DeviceEditDialog
  device={editDevice}
  open={editDevice !== null}
  onClose={() => setEditDevice(null)}
  onSaved={handleEditSaved}
/>
<DeviceDeleteDialog
  device={deleteDevice}
  open={deleteDevice !== null}
  onClose={() => setDeleteDevice(null)}
  onDeleted={handleDeleteDone}
/>
```

## 模块交互

```
用户点击编辑
  → DevicesPage.setEditDevice(device)
  → DeviceEditDialog 打开，预填字段
  → 用户修改字段，点击保存
  → DeviceEditDialog 调用 updateDeviceYaml(filePath, updates)
  → 文件写入成功
  → DeviceEditDialog.onSaved(device)
  → DevicesPage.reload() + toast + 关闭 Dialog

用户点击删除
  → DevicesPage.setDeleteDevice(device)
  → DeviceDeleteDialog 打开，展示确认
  → 用户确认删除
  → DeviceDeleteDialog 调用 trashDeviceFile(filePath)
  → OS 回收站操作成功
  → DeviceDeleteDialog.onDeleted()
  → DevicesPage.reload() + toast + 关闭 Dialog
```

## 文件组织

```
src/
├── lib/
│   └── devices.ts              ← 修改：新增 updateDeviceYaml / trashDeviceFile / parseYamlLines / replaceYamlFieldValue
├── components/
│   ├── DeviceEditDialog.tsx     ← 新建：编辑配置对话框
│   ├── DeviceDeleteDialog.tsx   ← 新建：删除确认对话框
│   ├── DeviceDetailDialog.tsx   ← 不变
│   └── DeviceCard.tsx           ← 不变
├── pages/
│   └── DevicesPage.tsx          ← 修改：编排编辑/删除 Dialog
├── types/
│   └── device.ts               ← 修改：Device 新增 filePath
└── hooks/
    └── useDevices.ts            ← 不变（reload() 已由 useDevices 提供）
src-tauri/
└── capabilities/
    └── default.json             ← 修改：新增 fs:allow-write-text-file, fs:allow-trash
```

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| YAML 更新策略 | 文本级行索引替换 | 满足 N1（保留注释与格式），只操作具体行，不 dump 整份 |
| 密码脱敏 | 编辑 Dialog 中默认用 `·` 占位，聚焦清空 | N2 要求；保留字段长度信息，且允许用户修改 |
| 字段变更检测 | dirtyFields Set 跟踪 | 满足 N3（幂等保存）；比 diff 两对象更轻量 |
| 编辑 Dialog | 新建组件（非复用 DetailDialog） | DetailDialog 为只读，表单逻辑完全不同；分开更清晰 |
| 删除确认 | 自定义 Dialog 组件 | 用户明确选择；与项目现有 Dialog 风格一致 |
| 回收站 | Tauri `trash()` API | 满足 OS 回收站要求；已有 `@tauri-apps/plugin-fs` 依赖 |
| 文件写入 | `writeTextFile` | Tauri v2 fs 插件原生支持，写入 UTF-8 与读取一致 |
| 设备列表刷新 | `useDevices().reload()` | 已有 reload 机制，无需引入新状态管理 |

## 编码规范

**编程语言：** TypeScript

**适用的语言规范技能：** ts-lang-spec

**文件编码规则（语言规范技能优先，以下为兜底）：**
- **新建文件**：UTF-8 无 BOM、LF 换行。
- **修改已有文件**（硬规则，不得覆盖）：必须保持原文件编码与换行符不变（如原为 GB2312/GBK 则仍按原编码写回，绝不转换）。
