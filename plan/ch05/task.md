# 设备编辑与删除功能 Tasks

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/types/device.ts` | Device 接口新增 `filePath` 字段 |
| 修改 | `src/lib/devices.ts` | 新增 YAML 行解析器、字段替换、写入、回收站函数 |
| 修改 | `src-tauri/capabilities/default.json` | 新增写文件与回收站权限 |
| 新建 | `src/components/DeviceEditDialog.tsx` | 设备编辑配置 Dialog |
| 新建 | `src/components/DeviceDeleteDialog.tsx` | 删除确认 Dialog |
| 修改 | `src/pages/DevicesPage.tsx` | 编排编辑/删除 Dialog，替换桩函数 |

## T1：扩展 Device 类型 + 补充 Tauri 权限

**文件：** `src/types/device.ts`, `src/lib/devices.ts`, `src-tauri/capabilities/default.json`

**依赖：** 无

**步骤：**
1. `src/types/device.ts`：Device 接口新增 `filePath: string` 字段
2. `src/lib/devices.ts`：在 `readDevices()` 的 `parseDevice()` 调用处，补充 `filePath` 参数传递；`parseDevice` 签名新增 `filePath` 参数并写入 Device 对象
3. `src-tauri/capabilities/default.json`：permissions 数组中追加 `"fs:allow-write-text-file"` 和 `"fs:allow-trash"`

**验证：** `npx tsc --noEmit` 编译通过；`readDevices` 返回的设备对象含 `filePath` 字段

## T2：实现 YAML 解析行索引工具

**文件：** `src/lib/devices.ts`

**依赖：** T1

**步骤：**
1. 新增 `YamlLineEntry` 接口（`path: string[]`, `lineIndex: number`, `indent: number`, `key: string`, `valueRaw: string`, `valueStart: number`）
2. 新增 `parseYamlLines(yamlText: string): YamlLineEntry[]` 函数：
   - 按 `\n` 分割文本
   - 使用缩进栈追踪当前路径（遇到缩进增加则进入子对象，缩进减少则回溯父级）
   - 跳过空行和纯注释行
   - 跳过 container 行（仅 key: 无值）
   - 为每个 scalar 行（`key: value`）记录其点分路径、行号、缩进、值
3. 新增 `replaceYamlFieldValue(rawLine: string, newValue: string | number | undefined): string` 函数：
   - 从 `key:` 后的值部分做替换，保留前导空格和 key
   - `undefined` 时返回空字符串（删除该行）
   - 数值按 `String(newValue)` 直接替换
   - 字符串值保留原行引号风格（无引号/单引号/双引号）
4. 用 `describe` / `it` 编写测试验证关键场景：
   - 多级路径解析（`ssh.password`）
   - 值替换保留引号
   - undefined 清空行

**验证：** 测试通过确认索引构建与替换逻辑正确

## T3：实现 updateDeviceYaml + trashDeviceFile

**文件：** `src/lib/devices.ts`

**依赖：** T2

**步骤：**
1. 顶部导入补充 `writeTextFile, trash` from `@tauri-apps/plugin-fs`
2. 新增 `updateDeviceYaml(filePath: string, updates: Record<string, string | number | undefined>): Promise<string>`：
   - 调用 `readTextFile(filePath)` 读取原始文本
   - 调用 `parseYamlLines()` 构建行索引
   - 遍历 `updates`，查找每项的行索引，调用 `replaceYamlFieldValue()` 替换
   - 变更后的行重新赋值到 lines 数组
   - `lines.join('\n')` 重组全文
   - 调用 `writeTextFile(filePath, newText)` 写入
   - 返回新文本（供调用方缓存 rawYaml）
3. 新增 `trashDeviceFile(filePath: string): Promise<void>`：
   - 调用 `trash(filePath)` 移入 OS 回收站

**验证：** `npx tsc --noEmit` 编译通过

## T4：创建设备编辑对话框 DeviceEditDialog

**文件：** `src/components/DeviceEditDialog.tsx`（新建）

**依赖：** T1, T3

**步骤：**
1. 新建文件，实现 `DeviceEditDialog` 组件
2. 组件接口：
   ```typescript
   interface DeviceEditDialogProps {
     device: Device | null;    // null 时 Dialog 关闭
     onClose: () => void;
     onSaved: () => void;     // 保存成功后调用（通知父级刷新）
   }
   ```
3. 表单状态：内部维护 `Record<string, string>` 映射（key 为点分路径，如 `"ssh.password"`），初始化时从 `device` 对象展平填充
4. 按 SSH / Serial / ADB 三区块渲染表单字段：
   - `password` / `loginPassword` → `<input type="password">`
   - `port` / `baudRate` → `<input type="number">`
   - 其余字符串 → `<input type="text">`
   - `keyProvider.*` 子字段 → `<input type="text">`
5. 密码脱敏逻辑：
   - 初始化时密码字段填入 `MASKED_VALUE` 按长度重复的占位符
   - 用户聚焦时清空占位符
   - 若 blur 时仍为空，恢复原占位符（表示未修改）
   - 保存时，若密码值等于占位符则排除该字段（不更新）
6. 脏字段跟踪：每次 onChange 记录字段名到 dirtyFields Set
7. 保存按钮逻辑：
   - 从 dirtyFields 收集 `updates` 对象
   - 若 dirtyFields 为空则直接关闭（N3 幂等保存）
   - 调用 `updateDeviceYaml(device.filePath, updates)`
   - 成功后调用 `onSaved()`
   - 失败时 toast 错误，不关闭 Dialog
8. 底部「取消」「保存」按钮（保存按钮含 loading 态）
9. 使用项目已有的 `Dialog` 组件包裹，保持与 DeviceDetailDialog 一致的视觉风格

**验证：** 页面编译通过；编辑 Dialog 可正确打开、填值、保存

## T5：创建设备删除确认对话框 DeviceDeleteDialog

**文件：** `src/components/DeviceDeleteDialog.tsx`（新建）

**依赖：** T1, T3

**步骤：**
1. 新建文件，实现 `DeviceDeleteDialog` 组件
2. 组件接口：
   ```typescript
   interface DeviceDeleteDialogProps {
     device: Device | null;    // null 时 Dialog 关闭
     onClose: () => void;
     onDeleted: () => void;   // 删除成功后调用
   }
   ```
3. Dialog 内容：
   - 标题："删除设备"
   - 正文：`确定要将「{设备名}」移入回收站吗？此操作可在系统回收站中还原。`
4. 底部「取消」「确定删除」按钮（确定删除使用危险红色样式）
5. 确认删除逻辑：
   - 调用 `trashDeviceFile(device.filePath)`
   - 成功后调用 `onDeleted()`
   - 失败时 toast 错误，不关闭 Dialog
6. 使用项目已有的 `Dialog` 组件包裹

**验证：** 页面编译通过；删除 Dialog 可正常打开、确认、取消

## T6：改造 DevicesPage 编排编辑/删除 Dialog

**文件：** `src/pages/DevicesPage.tsx`

**依赖：** T4, T5

**步骤：**
1. 导入 `DeviceEditDialog` 和 `DeviceDeleteDialog`
2. 新增 state：`editDevice` 和 `deleteDevice`（均为 `Device | null`）
3. 将 `handleEdit` 从 toast 桩改为 `setEditDevice(device)`
4. 将 `handleDelete` 从 toast 桩改为 `setDeleteDevice(device)`
5. 新增 `handleEditSaved`：
   - 调用 `reload()`（从 `useDevices` 解构）
   - toast "设备配置已保存"
   - `setEditDevice(null)`
6. 新增 `handleDeleteDone`：
   - 调用 `reload()`
   - toast "设备已移入回收站"
   - `setDeleteDevice(null)`
7. 新增 JSX 渲染两个 Dialog（置于详情 Dialog 之后）

**验证：** 编辑→保存→列表刷新；删除→确认→列表刷新；取消→无操作

## 执行顺序

```
T1 ──→ T2 ──→ T3 ──┬──→ T4 ──┐
                    │          ├──→ T6
                    └──→ T5 ──┘
```

1. **T1** — 扩展类型 + 权限（基础准备）
2. **T2** — YAML 行解析器（核心工具）
3. **T3** — 写入 + 回收站函数（文件操作封装）
4. **T4** — 编辑对话框（UI + 保存流程）
5. **T5** — 删除确认对话框（UI + 删除流程，可与 T4 并行）
6. **T6** — 页面编排（串联所有组件）
