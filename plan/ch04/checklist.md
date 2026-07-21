# 设备管理重构（读取 yaml）Checklist

> 每一项通过运行代码或观察行为来验证，聚焦系统行为，与实现解耦。

## 实现完整性

- [ ] 引入 js-yaml 依赖：`package.json` 的 dependencies 含 js-yaml、devDependencies 含 @types/js-yaml（验证：`pnpm install` 无报错，`node_modules/js-yaml` 存在）
- [ ] 设备类型模型已按通道重建：Device 含 ssh/serial/adb/rawYaml 字段，旧的 type/status/ip/mac/os 已移除（验证：`tsc --noEmit` 通过，`grep -rn "DeviceStatus\b\|DeviceType\b" src/` 无残留定义）
- [ ] 设备数据层可读取并解析 yaml：给定有效根路径，能列出 devices 子目录下 yaml 文件并解析为设备数组（验证：`tsc --noEmit` 通过；运行应用在已配置路径下进入设备页，列表非空）
- [ ] 引导态两种情况均可区分渲染：路径为空 vs 目录不存在（验证：观察 UI 文案不同）
- [ ] 四个操作按钮均存在且可点击：详情/复制/编辑/删除（验证：悬停设备卡片，操作区出现四个按钮）

## 集成

- [ ] 设备页引导态跳转有效：点击"去设置"按钮后右侧内容切换为设置页（验证：观察右侧内容区变为目录配置卡片）
- [ ] 详情对话框正确接入：点「详情」弹出 Modal 展示该设备完整配置（验证：弹窗内容含 SSH/Serial/ADB 通道字段）
- [ ] 复制功能接入剪贴板：点「复制」后剪贴板含该设备原始 yaml 全文（验证：复制后粘贴到文本编辑器，内容为 yaml 原文）
- [ ] ToastContainer 挂载在应用根，所有页面共享（验证：在设备页触发一次复制，右上角出现提示）
- [ ] ContentArea 已透传 onSwitch 给 DevicesPage（验证：`tsc --noEmit` 通过，引导态按钮可触发跳转）
- [ ] 旧资产已清理：DeviceStatusBadge 删除、MOCK_DEVICES/类型图标/状态样式移除（验证：`grep -rn "DeviceStatusBadge\|MOCK_DEVICES\|DEVICE_TYPE_ICON\|DEVICE_STATUS_STYLE" src/` 无结果）

## 编译与测试

- [ ] 项目编译无错误（验证：`npx tsc --noEmit` 无输出）
- [ ] 代码符合 plan.md 声明的 ts-lang-spec 要求（验证：人工检查命名/风格/JSDoc/文件头版权注释块齐全）
- [ ] 文件编码未被破坏：新建文件 UTF-8 无 BOM、LF 换行；修改的已有文件保持 LF（验证：`file` 命令或编辑器查看无 CRLF、无 BOM）
- [ ] js-yaml 导入方式正确无类型告警（验证：`tsc --noEmit` 通过）

## 端到端场景

- [ ] 场景 1（完整正常流程）：设置页配置 embedded-mcp-toolkit 路径 → 切换到设备页 → 展示 devices 目录下所有 yaml 对应卡片，数量与文件数一致 → 卡片密码字段显示为 `·` → 点「详情」弹出完整配置（含明文密码）→ 点「复制」后剪贴板为 yaml 全文，右上角 toast 提示成功
- [ ] 场景 2（未配置）：清空 embedded-mcp-toolkit 路径 → 进入设备页 → 显示"需配置"引导态 + 跳转按钮 → 点按钮跳到设置页
- [ ] 场景 3（路径无效）：embedded-mcp-toolkit 填一个不存在的路径 → 进入设备页 → 显示"目录不存在"区分性提示（区别于场景 2 文案）
- [ ] 场景 4（容错）：在 devices 目录放入一个格式错误的 yaml → 进入设备页 → 其余正常设备照常展示，错误文件被跳过不崩溃（验证：console 有 warn，列表不含错误文件但含其余文件）
- [ ] 场景 5（占位按钮）：点「编辑」→ toast 提示开发中，无文件变更；点「删除」→ 同样占位提示，文件仍在
