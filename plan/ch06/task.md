# 新增设备配置功能 Tasks

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/config/devices.ts` | 新增 `INVALID_NAME_CHARS` / `TEMPLATE_FILE_NAME` / `validateDeviceName()` |
| 修改 | `src/lib/devices.ts` | 新增 `createDeviceFromTemplate()` |
| 新建 | `src/components/DeviceCreateDialog.tsx` | 两阶段新增设备对话框 |
| 修改 | `src/components/Header.tsx` | 接收 `activeTab`，设备 tab 渲染「新增设备」按钮 |
| 修改 | `src/components/ContentArea.tsx` | 透传 `createOpen` / `onCreateClose` 到 DevicesPage |
| 修改 | `src/pages/DevicesPage.tsx` | 渲染 CreateDialog，提供 `existingNames` / `devicesDir`，处理创建回调 |
| 修改 | `src/App.tsx` | 持有 `createOpen` 状态，串联 Header 与 DevicesPage |

## T1：设备名校验常量与函数

**文件：** `src/config/devices.ts`

**依赖：** 无

**步骤：**
1. 新增常量 `INVALID_NAME_CHARS`：`["/", "\\", ":", "*", "?", '"', "<", ">", "|"] as const`，配 JSDoc 说明为文件名非法字符集合（跨平台取并集）
2. 新增常量 `TEMPLATE_FILE_NAME`：`"board-example" as const`，配 JSDoc 说明为模板文件名（固定）
3. 定义判别联合类型 `DeviceNameValidation`：
   ```typescript
   export type DeviceNameValidation =
     | { valid: true }
     | { valid: false; reason: string };
   ```
4. 新增纯函数 `validateDeviceName(name: string, existingNames: readonly string[]): DeviceNameValidation`：
   - `name.trim() === ""` → `{ valid: false, reason: "请输入设备名" }`
   - 含 `INVALID_NAME_CHARS` 任一字符 → `{ valid: false, reason: "设备名不能包含特殊字符：/ \\ : * ? \" < > |" }`
   - `existingNames.includes(name)` → `{ valid: false, reason: \`设备名「${name}」已存在\` }`
   - 其余 → `{ valid: true }`
5. 配完整 JSDoc，说明校验顺序（空 → 非法字符 → 重名）

**验证：** `npx tsc --noEmit` 编译通过

## T2：模板创建函数 createDeviceFromTemplate

**文件：** `src/lib/devices.ts`

**依赖：** T1（用到 `TEMPLATE_FILE_NAME`）

**步骤：**
1. 顶部从 `@/config/devices` 导入 `TEMPLATE_FILE_NAME`（若未导入）
2. 复用已有 `parseYamlLines` / `replaceYamlFieldValue`（ch05 已实现，无需改动）
3. 新增 `createDeviceFromTemplate(devicesDir, name, fieldUpdates): Promise<string>`：
   ```typescript
   export async function createDeviceFromTemplate(
     devicesDir: string,
     name: string,
     fieldUpdates: Record<string, string | number | undefined>,
   ): Promise<string>;
   ```
4. 函数实现：
   - `templatePath = ${devicesDir}/${TEMPLATE_FILE_NAME}.yaml`（devicesDir 末尾的正斜杠由调用方保证去除，与 readDevices 拼接逻辑一致）
   - `templateText = await readTextFile(templatePath)`（失败抛错，由调用方 toast）
   - 若 `fieldUpdates` 为空对象：`newText = templateText`
   - 否则复用 `updateDeviceYaml` 的替换算法（读取已无必要，直接用 templateText）：
     a. `lines = templateText.split("\n")`
     b. `index = parseYamlLines(templateText)`
     c. 遍历 fieldUpdates，查找行索引，跳过值未变的字段，调用 `replaceYamlFieldValue` 替换
     d. `newText = lines.join("\n")`
   - `targetPath = ${devicesDir}/${name}.yaml`
   - `await writeTextFile(targetPath, newText)`（失败抛错）
   - `return targetPath`
5. 配完整 JSDoc，说明：读模板失败 / 写入失败均抛错由调用方处理；fieldUpdates 为空时直接拷贝模板
6. **重构提示：** ch05 的 `updateDeviceYaml` 内部「读取 + 替换 + 写入」的替换逻辑与本函数高度重叠。可抽取私有函数 `applyFieldUpdates(rawText, fieldUpdates): string` 供两者复用，避免逻辑重复。此为可选优化，若抽取须确保 `updateDeviceYaml` 行为不变

**验证：** `npx tsc --noEmit` 编译通过

## T3：Header 改造——新增按钮入口

**文件：** `src/components/Header.tsx`

**依赖：** T1（无直接依赖，但与整体流程相关）

**步骤：**
1. 顶部导入 `Button` from `@/components/ui/button`、`Plus` from `lucide-react`、`TabId` 类型 from `@/config/nav`
2. 定义 `HeaderProps` 接口：
   ```typescript
   export interface HeaderProps {
     activeTab: TabId;
     onAddDevice: () => void;
   }
   ```
3. `Header` 函数签名改为接收 `{ activeTab, onAddDevice }: HeaderProps`
4. 将右侧预留 `<div>`（原注释「本期预留，后续章节可放置操作区」）替换为条件渲染：
   ```tsx
   <div>
     {activeTab === "devices" && (
       <Button
         onClick={onAddDevice}
         variant="ghost"
         size="sm"
         className="hover:bg-orange-500 hover:text-white"
       >
         <Plus className="h-4 w-4" />
         新增设备
       </Button>
     )}
   </div>
   ```
5. 更新组件 JSDoc：说明右侧操作区在设备 tab 显示「新增设备」按钮（ghost 风格，默认与其他操作按钮一致，悬浮橙色高亮），其余 tab 为空
6. 保留原文件头版权注释与编码格式不变

**验证：** `npx tsc --noEmit` 编译通过（此时 App.tsx 尚未传 props，预期会报 Header 缺 props 错误，T7 会修复——此任务标记为 T7 的前置）

> 注意：T3 修改 Header 签名后，App.tsx 的 `<Header />` 会编译报错。这是预期的中间状态，T7 会同步修改 App.tsx。task.md 的执行顺序保证 T7 在 T3 之后。

## T4：DeviceCreateDialog 新建——两阶段新增对话框

**文件：** `src/components/DeviceCreateDialog.tsx`（新建）

**依赖：** T1（validateDeviceName）、T2（createDeviceFromTemplate）

**步骤：**
1. 新建文件，加版权注释头（参考 DeviceEditDialog.tsx 的头格式，日期改为当天）
2. 顶部导入：
   - `useCallback, useEffect, useRef, useState` from `react`
   - `Dialog` from `@/components/ui/dialog`
   - `useToast` from `@/hooks/useToast`
   - `Button` from `@/components/ui/button`
   - `createDeviceFromTemplate` from `@/lib/devices`
   - `validateDeviceName`, `INVALID_NAME_CHARS`, `TEMPLATE_FILE_NAME`, `MASKED_VALUE` from `@/config/devices`
   - `readTextFile` from `@tauri-apps/plugin-fs`
   - `load` from `js-yaml`
   - `Device`, `SshChannel`, `SerialChannel`, `AdbChannel` 类型 from `@/types/device`
3. 定义 `DeviceCreateDialogProps` 接口（按 plan 模块 3）
4. 定义阶段类型：`type Stage = "name" | "config"`
5. 定义 `FormField` / `FieldGroup` 接口（与 DeviceEditDialog 同构，供配置界面渲染）
6. 实现 `parseTemplateDevice(rawText): Device` 内部函数：用 `load(rawText)` 解析，按 `parseDevice`（lib/devices.ts）的同样逻辑提取 ssh/serial/adb 通道（此函数可考虑从 lib 导出复用，见 T2 重构提示）
7. 实现 `buildInitialValuesFromTemplate(device: Device): Record<string, string>`：参考 DeviceEditDialog 的 `buildInitialValues`，把模板 Device 展平为表单初始值（密码字段同样用 MASKED_VALUE 占位）
8. 定义三区块字段组 `FIELD_GROUPS: FieldGroup[]`（SSH/Serial/ADB，与 DeviceEditDialog 一致）——但 enabled 判断改为「模板中该通道存在即展示」（模板三通道都有值，故三区块都会显示）
9. 组件主体实现：
   - 内部状态：`stage` / `name` / `touched` / `template`(TemplateDevice|null) / `templateError`(boolean) / `values` / `loadingTemplate` / `saving`
   - `useEffect` 监听 `open`：open 变 true 时重置全部状态到初始（stage="name", name="", touched=false, template=null, values={}）；open 变 false 时也重置（兜底）
   - 校验派生值：`const validation = touched ? validateDeviceName(name, existingNames) : { valid: true }`（未 touched 不显示空值错误，避免一打开就标红）
   - `handleNameChange(value)`：setName + setTouched(true)
   - `handleNext()`（下一步）：调用 `loadTemplate()` 异步函数：
     a. setLoadingTemplate(true)
     b. `rawText = await readTextFile(${devicesDir}/${TEMPLATE_FILE_NAME}.yaml)`
     c. `device = parseTemplateDevice(rawText)`
     d. setTemplate({ device, rawText })；setValues(buildInitialValuesFromTemplate(device))
     e. setStage("config")
     f. catch：show("模板文件读取失败，请检查 board-example.yaml 是否存在", "error")；setTemplateError(true)（保持阶段一）
     g. finally：setLoadingTemplate(false)
   - 配置界面字段渲染：复用 DeviceEditDialog 的 input 渲染模式（含密码脱敏 onFocus/onBlur 逻辑）
   - `handleSave()`：
     a. 构建 fieldUpdates：遍历 FIELD_GROUPS 全部字段，取 values[path]，与模板原值比对（密码字段需特殊处理：仍为 MASKED_VALUE 占位则视为未改），不同的才纳入
     b. setSaving(true)
     c. `await createDeviceFromTemplate(devicesDir, name, fieldUpdates)`
     d. onCreated(name)
     e. catch：show("创建失败，请稍后重试", "error")
     f. finally：setSaving(false)
   - `handleClose()`：重置全部状态 + onClose()（F6 取消保护）
10. JSX 结构：
    - `<Dialog open={open} onClose={handleClose} title={...}>`
    - 阶段一（stage === "name"）：
      · 设备名输入框（value=name, onChange, 边框颜色随 validation.valid 变化）
      · 校验失败时显示红色 reason 文案
      · 底部「取消」「下一步」按钮（下一步 disabled = !validation.valid || loadingTemplate）
    - 阶段二（stage === "config"）：
      · 标题动态：「配置新设备 · {name}」
      · 三区块字段表单（与 EditDialog 视觉一致）
      · 底部「上一步」「保存」按钮
11. 密码脱敏逻辑：复用 DeviceEditDialog 的 handlePasswordFocus / handlePasswordBlur 模式（origRef 改为 template.device 快照）

**验证：** `npx tsc --noEmit` 编译通过

## T5：DevicesPage 改造——渲染 CreateDialog

**文件：** `src/pages/DevicesPage.tsx`

**依赖：** T2、T4

**步骤：**
1. 顶部导入：
   - `DeviceCreateDialog` from `@/components/DeviceCreateDialog`
   - `useDirectoryConfig` from `@/hooks/useDirectoryConfig`
   - `PRESET_DEVICE_DIR_NAME`, `DEVICES_SUBDIR` from `@/config/devices`
2. `DevicesPageProps` 新增字段：
   ```typescript
   createOpen: boolean;
   onCreateClose: () => void;
   ```
3. 组件内新增 `useDirectoryConfig()` 调用，取 presetItem.path（与 useDevices 内部逻辑一致）：
   ```typescript
   const { items, isLoading: dirLoading } = useDirectoryConfig();
   const presetItem = dirLoading
     ? undefined
     : items.find((i) => i.isPreset && i.name === PRESET_DEVICE_DIR_NAME);
   const basePath = presetItem?.path ?? "";
   const devicesDir = basePath ? `${basePath.replace(/[\\/]+$/, "")}/${DEVICES_SUBDIR}` : "";
   ```
4. 计算 `existingNames`：
   ```typescript
   const existingNames = status.kind === "ready" ? status.devices.map((d) => d.name) : [];
   ```
5. 新增 `handleCreated(name: string)`：
   ```typescript
   const handleCreated = (name: string): void => {
     reload();
     show(`设备「${name}」已创建`, "success");
     onCreateClose();
   };
   ```
6. 在已有 Dialog 渲染区（详情/编辑/删除 Dialog 之后）新增：
   ```tsx
   <DeviceCreateDialog
     existingNames={existingNames}
     devicesDir={devicesDir}
     open={createOpen}
     onClose={onCreateClose}
     onCreated={handleCreated}
   />
   ```
7. 更新组件 JSDoc，说明新增了 CreateDialog 编排

**验证：** `npx tsc --noEmit` 编译通过（此时 ContentArea 尚未传 createOpen/onCreateClose，预期报错，T6/T7 修复）

## T6：ContentArea 改造——透传 props

**文件：** `src/components/ContentArea.tsx`

**依赖：** T5

**步骤：**
1. `ContentAreaProps` 新增字段：
   ```typescript
   createOpen: boolean;
   onCreateClose: () => void;
   ```
2. `renderPage` 函数签名新增 `createOpen: boolean` 与 `onCreateClose: () => void` 参数
3. `renderPage` 的 devices 分支传入：
   ```tsx
   <DevicesPage
     onNavigateSettings={() => onSwitch("settings")}
     createOpen={createOpen}
     onCreateClose={onCreateClose}
   />
   ```
4. 兜底 default 分支（同样返回 DevicesPage）也补上这两个 props
5. `ContentArea` 函数体解构 `createOpen`, `onCreateClose` 并传给 `renderPage`
6. 更新 JSDoc

**验证：** `npx tsc --noEmit` 编译通过（App.tsx 未传 createOpen，预期报错，T7 修复）

## T7：App 改造——持有 createOpen 状态串联全流程

**文件：** `src/App.tsx`

**依赖：** T3、T5、T6（前置任务的接口都已就位）

**步骤：**
1. 顶部导入 `useState` from `react`
2. App 函数内新增状态：
   ```typescript
   const [createOpen, setCreateOpen] = useState(false);
   ```
3. Header 渲染改为传 props（修复 T3 引入的编译错误）：
   ```tsx
   <Header activeTab={activeTab} onAddDevice={() => setCreateOpen(true)} />
   ```
4. ContentArea 渲染改为传 props（修复 T5/T6 引入的编译错误）：
   ```tsx
   <ContentArea
     activeTab={activeTab}
     onSwitch={setActiveTab}
     createOpen={createOpen}
     onCreateClose={() => setCreateOpen(false)}
   />
   ```
5. 更新组件 JSDoc，说明持有 createOpen 状态用于串联 Header 新增按钮与 DevicesPage 的 CreateDialog

**验证：** `npx tsc --noEmit` 全项目编译通过，无错误

## 执行顺序

```
T1 ──┬──→ T2 ──┬──→ T4 ──┐
     │         │          ├──→ T5 ──→ T6 ──→ T7
     │         └──────────┘
     └──→ T3 ──────────────────────────────────↗
```

1. **T1** — 校验常量与函数（基础，无依赖）
2. **T2** — 模板创建函数（依赖 T1 的 TEMPLATE_FILE_NAME）
3. **T3** — Header 改造（依赖 T1，可与 T2 并行；改签名会引入临时编译错误，由 T7 收尾）
4. **T4** — CreateDialog 新建（依赖 T1、T2，核心组件）
5. **T5** — DevicesPage 改造（依赖 T2、T4）
6. **T6** — ContentArea 透传（依赖 T5）
7. **T7** — App 串联（依赖 T3、T5、T6，收尾消除全部临时编译错误）

> **关键约束**：T3、T5、T6 各自会引入临时编译错误（props 未透传），只有 T7 完成后整项目才恢复编译通过。建议 T3→T5→T6→T7 连续执行，中间不单独验证编译。
