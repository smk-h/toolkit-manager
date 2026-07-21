# 设备管理重构（读取 yaml）Tasks

## 文件清单

| 操作 | 文件 | 职责 |
| --- | --- | --- |
| 新建 | `package.json` | 新增 js-yaml + @types/js-yaml 依赖 |
| 重写 | `src/types/device.ts` | Device/SshChannel/SerialChannel/AdbChannel 通道模型 |
| 改造 | `src/config/devices.ts` | 移除 Mock/类型图标/状态样式；新增预置项 name 常量、devices 子目录常量、通道摘要格式化函数 |
| 新建 | `src/lib/devices.ts` | readDevices + yaml 解析 + 通道启停判断 |
| 新建 | `src/lib/clipboard.ts` | 复制封装（navigator.clipboard + execCommand 兜底） |
| 新建 | `src/components/ui/dialog.tsx` | Modal 基础组件（遮罩+居中面板+ESC/遮罩关闭） |
| 新建 | `src/components/ui/toast.tsx` | 轻量全局提示渲染器 |
| 新建 | `src/hooks/useToast.ts` | toast 状态管理（show + 队列 + 自动消失） |
| 新建 | `src/hooks/useDevices.ts` | 设备列表加载状态 + reload |
| 重写 | `src/components/DeviceCard.tsx` | 通道摘要展示 + 四操作按钮（橙色悬停） |
| 新建 | `src/components/DeviceDetailDialog.tsx` | 详情 Modal（分通道展示完整配置） |
| 改造 | `src/components/ContentArea.tsx` | 透传 onSwitch 给 DevicesPage |
| 重写 | `src/pages/DevicesPage.tsx` | status 分流 + 引导态 + 列表 + 详情/复制编排 |
| 改造 | `src/App.tsx` | 向 ContentArea 传 onSwitch |
| 删除 | `src/components/DeviceStatusBadge.tsx` | 真实数据无在线状态概念，废弃 |
| 改造 | `src/index.css` | （如需）toast/dialog 的基础动画样式 |

## T1: 新增 yaml 解析依赖

**文件：** `package.json`
**依赖：** 无
**步骤：**
1. 执行 `pnpm add js-yaml` 与 `pnpm add -D @types/js-yaml`
2. 确认 `package.json` 的 dependencies 含 `js-yaml`、devDependencies 含 `@types/js-yaml`

**验证：** `pnpm install` 无报错；`node_modules/js-yaml` 存在；`tsc --noEmit` 通过

## T2: 重建设备类型模型

**文件：** `src/types/device.ts`
**依赖：** 无
**步骤：**
1. 删除旧的 `DeviceStatus`、`DeviceType`、`Device`（ip/mac/os 那套）
2. 定义 `KeyProvider`（mode/challengeFilePath/keyFilePath/pollInterval/timeout，全可选）
3. 定义 `SshChannel`（host/port/username/password/keyProvider，全可选）
4. 定义 `SerialChannel`（port/baudRate/loginUsername/loginPassword/keyProvider/uboot，全可选；uboot 用 `Record<string, unknown>`）
5. 定义 `AdbChannel`（serialNo 可选）
6. 定义 `Device`（name 必填；ssh/serial/adb 可选；rawYaml 必填）
7. 保留文件头版权注释块与 JSDoc 风格

**验证：** `tsc --noEmit`（此时因 config/devices.ts、DeviceCard 等仍引用旧类型会报错，属预期，T3+ 逐步消除）

## T3: 改造 config/devices.ts

**文件：** `src/config/devices.ts`
**依赖：** T2
**步骤：**
1. 删除 `DEVICE_TYPE_ICON`、`DeviceStatusStyle`、`DEVICE_STATUS_STYLE`、`MOCK_DEVICES`
2. 删除对 `Device/DeviceStatus/DeviceType` 旧类型的 import
3. 新增常量 `PRESET_DEVICE_DIR_NAME = "embedded-mcp-toolkit"`（预置项 name，供数据层匹配）
4. 新增常量 `DEVICES_SUBDIR = ".embedded/configs/devices"`（相对 embedded-mcp-toolkit 根的子目录，用正斜杠跨平台）
5. 新增纯函数 `formatSshSummary(ssh)`：返回 `user@host:port` 或未启用标识
6. 新增纯函数 `formatSerialSummary(serial)`：返回 `port@baudRate` 或未启用标识
7. 新增纯函数 `formatAdbSummary(adb)`：返回序列号或未绑定标识
8. 新增 `maskValue()`：返回脱敏占位 `"·"`（供卡片调用）

**验证：** `tsc --noEmit`（DeviceCard 仍报错，预期）

## T4: 新建 lib/devices.ts（数据读取与解析）

**文件：** `src/lib/devices.ts`
**依赖：** T2、T3
**步骤：**
1. 定义 `DevicesStatus` 判别联合（loading/no-path/dir-missing/ready/error）
2. 定义 `isSshEnabled(ssh)`：存在且 `host !== "none"`
3. 定义 `isSerialEnabled(serial)`：存在且 `port !== "none"`
4. 定义 `isAdbEnabled(adb)`：存在且 serialNo 非空且非 `"sn_none"`
5. 定义 `isTauriEnv()`（与 store.ts 同款降级判断）
6. 定义 `readDevices(basePath): Promise<{ kind, devices? }>`：
   - basePath 为空 → 返回 `{ kind: "no-path" }`
   - 拼接 `basePath + DEVICES_SUBDIR`
   - 非 Tauri 环境 → `{ kind: "error" }`
   - `readDir` 列目录；目录不存在（catch）→ `{ kind: "dir-missing" }`
   - 过滤 `.yaml`/`.yml` 文件
   - 逐文件 `readTextFile` → `js-yaml.load` → 组装 Device（name=文件名去扩展名，rawYaml=原文）
   - 单文件失败 → `console.warn` 跳过，继续其余
   - 全部完成 → `{ kind: "ready", devices }`
7. 完整 JSDoc + 文件头

**验证：** `tsc --noEmit` 通过

## T5: 新建 lib/clipboard.ts

**文件：** `src/lib/clipboard.ts`
**依赖：** 无
**步骤：**
1. 定义 `copyText(text): Promise<boolean>`
2. 优先 `navigator.clipboard.writeText`，成功返回 true
3. catch 降级 `document.execCommand('copy')`（创建临时 textarea + select + execCommand）
4. 都失败返回 false
5. JSDoc 说明降级链

**验证：** `tsc --noEmit` 通过

## T6: 新建 ui/dialog.tsx

**文件：** `src/components/ui/dialog.tsx`
**依赖：** 无
**步骤：**
1. 定义 `DialogProps`：`{ open: boolean; onClose: () => void; children; title?: string; className? }`
2. open 为 false 时返回 null
3. 渲染：fixed 遮罩（bg-black/50）+ 居中面板（bg-card rounded-xl border shadow）
4. ESC 键监听（useEffect 加 keydown）触发 onClose
5. 点击遮罩（非面板）触发 onClose
6. 面板内：可选标题 + children + 关闭按钮（右上角 X）
7. JSDoc + 文件头

**验证：** `tsc --noEmit` 通过

## T7: 新建 hooks/useToast.ts + ui/toast.tsx

**文件：** `src/hooks/useToast.ts`、`src/components/ui/toast.tsx`
**依赖：** 无
**步骤：**
1. useToast.ts：模块级单例 toast 队列状态（或 context，本版用模块级简化）
2. 定义 `Toast` 类型：`{ id, message, type: 'info'|'success'|'error' }`
3. 导出 `useToast()`：返回 `{ toasts, show(message, type?), dismiss(id) }`
4. show 自动生成 id、加入队列、setTimeout 后自动 dismiss（默认 2.5s）
5. ui/toast.tsx：定义 `<ToastContainer />`，消费 useToast 渲染右上角堆叠提示（framer-motion 淡入淡出，复用项目已有 framer-motion）
6. success 绿、error 红、info 灰
7. JSDoc + 文件头

**验证：** `tsc --noEmit` 通过

## T8: 新建 hooks/useDevices.ts

**文件：** `src/hooks/useDevices.ts`
**依赖：** T4、useDirectoryConfig（已存在）
**步骤：**
1. 定义 `useDevices()` 返回 `{ status: DevicesStatus; reload: () => void }`
2. 从 `useDirectoryConfig().items` 按 `name === PRESET_DEVICE_DIR_NAME && isPreset` 取预置项 path
3. useEffect（依赖 path）：path 空时 status 直接置 `no-path`；否则调用 `readDevices(path)` 设 status
4. 加载前置 status 为 `loading`
5. reload：重新触发 readDevices（用一个 state 计数器作为 effect 依赖，或直接调用）
6. 注意：useDirectoryConfig 自身有 isLoading，组合时需等待 items 就绪
7. JSDoc + 文件头

**验证：** `tsc --noEmit` 通过

## T9: 重写 DeviceCard.tsx

**文件：** `src/components/DeviceCard.tsx`
**依赖：** T2、T3
**步骤：**
1. 删除旧 DeviceCard（图标方块/状态徽章/ip·mac·os/configSummary/旧 props）
2. 新 props：`{ device: Device; onDetail; onCopy; onEdit; onDelete }`
3. 卡片布局：设备名（主标题）+ 各已启用通道的连接摘要（用 formatSshSummary 等）一行展示；password 类字段不展示或脱敏
4. 右侧操作区（保留悬停淡入 group-hover 骨架）：详情(Info)、复制(Copy)、编辑(Edit)、删除(Trash2) 四按钮，统一橙色悬停
5. 点击按钮 stopPropagation 不触发卡片选中（若保留卡片可点选）；本版卡片无可点选行为，按钮直接调回调
6. JSDoc + 文件头

**验证：** `tsc --noEmit`（DevicesPage 还未接入，预期 DevicesPage 报错）

## T10: 新建 DeviceDetailDialog.tsx

**文件：** `src/components/DeviceDetailDialog.tsx`
**依赖：** T2、T6
**步骤：**
1. props：`{ device: Device | null; onClose: () => void }`
2. device 为 null 时 Dialog open=false
3. Dialog 标题：设备名
4. 内容分三区块：SSH / Serial / ADB，每区块列出该通道所有已定义字段（键值对形式）
5. password/loginPassword 等明文展示（详情场景需核对完整配置）
6. 通道未配置时该区块显示"未配置"
7. 底部可加"关闭"按钮
8. JSDoc + 文件头

**验证：** `tsc --noEmit` 通过

## T11: 改造 ContentArea.tsx + App.tsx（透传 onSwitch）

**文件：** `src/components/ContentArea.tsx`、`src/App.tsx`
**依赖：** 无
**步骤：**
1. ContentAreaProps 增加 `onSwitch: (tab: TabId) => void`
2. renderPage 改为接收 onSwitch 并传给 DevicesPage（其余页面暂不需要，保持签名简单：仅 devices 传）
3. App.tsx 中 `<ContentArea activeTab={activeTab} />` 改为传入 `onSwitch={setActiveTab}`
4. JSDoc 更新

**验证：** `tsc --noEmit`（DevicesPage 重写后才能消除最终报错）

## T12: 重写 DevicesPage.tsx

**文件：** `src/pages/DevicesPage.tsx`
**依赖：** T8、T9、T10、T11、T5、T7
**步骤：**
1. 删除旧 DevicesPage（selectedId/MOCK_DEVICES 那套）
2. props：`{ onNavigateSettings: () => void }`
3. 用 useDevices 取 status，用 useToast 取 show
4. status.kind 穷尽 switch 渲染：
   - `loading` → 加载提示
   - `no-path` → 引导态（提示文案 + "去设置"按钮 → onNavigateSettings）
   - `dir-missing` → 引导态（区分文案：路径已填但目录不存在，仍提供去设置按钮）
   - `error` → 错误提示
   - `ready` → 设备总数标题 + DeviceCard 列表（空数组时显示空状态）
5. 详情状态：`const [detailDevice, setDetailDevice] = useState<Device | null>(null)`
6. handleCopy：copyText(device.rawYaml) → 成功 show("已复制")/失败 show("复制失败", error)
7. handleEdit/handleDelete：show("功能开发中", info)
8. 渲染 `<DeviceDetailDialog device={detailDevice} onClose={...} />`
9. 渲染 `<ToastContainer />`
10. JSDoc + 文件头

**验证：** `tsc --noEmit` 全项目通过

## T13: 删除 DeviceStatusBadge + 清理残留引用

**文件：** `src/components/DeviceStatusBadge.tsx`（删除）
**依赖：** T9（确认无引用后）
**步骤：**
1. 全局搜索 `DeviceStatusBadge` 引用，确认仅 DeviceCard 曾用（已在 T9 重写移除）
2. 删除文件
3. 确认无其它残留引用旧 `DeviceStatus`/`DeviceType`/`MOCK_DEVICES` 的地方

**验证：** `tsc --noEmit` 全项目通过；`grep -r "DeviceStatusBadge\|MOCK_DEVICES\|DeviceStatus\b" src/` 无结果

## T14: 挂载 ToastContainer 到应用根

**文件：** `src/App.tsx`
**依赖：** T7
**步骤：**
1. App.tsx import `<ToastContainer />`
2. 在根 div 内渲染（与 Header/SideNav/ContentArea 同级）
3. 这样所有页面共享同一 toast 实例

**验证：** `tsc --noEmit` 通过；运行应用触发一次 toast（如复制）观察右上角提示

## 执行顺序

```
T1（依赖） → T2（类型） → T3（config） → T4（lib/devices）
                                          │
T5（clipboard）─────────────────────────── │（并行）
T6（dialog）─────────────────────────────── │（并行）
T7（toast）───────────────────────────────── │（并行）
                                           ▼
                          T8（useDevices）→ T9（DeviceCard）→ T10（DetailDialog）
                                                                        │
T11（ContentArea/App 透传）────────────────────────────────────────────── │（并行）
                                                                        ▼
                                                            T12（DevicesPage 重写）
                                                                        │
                                                            T13（删除残留）→ T14（挂载 toast）
```

T5/T6/T7 可在 T4 后并行；T11 可在 T12 前任意时点做。最终 T12 是集成点，依赖绝大多数模块就绪。
