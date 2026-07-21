# 设备管理重构（读取 yaml）Spec

## 一、背景

当前设备管理页（`DevicesPage`）展示的是硬编码 Mock 数据（`MOCK_DEVICES`），其数据模型以"消费级设备 + 在线状态 + IP/MAC/OS"为核心：设备类型为 laptop/desktop/server/mobile，含 online/degraded/offline 状态徽章。

经核查真实数据源 `embedded-mcp-toolkit\.embedded\configs\devices\` 目录下的 yaml 文件，二者结构差异很大：

| 维度 | 现有 Mock 模型 | 真实 yaml |
| --- | --- | --- |
| 设备身份 | 固定 5 条，含 id/type | 文件名即设备名，无固定 id |
| 核心字段 | ip / mac / os / configSummary | 通信通道：`ssh` / `serial` / `adb` |
| 在线状态 | online/degraded/offline 徽章 | 无此概念，仅有"通道启用/禁用"（如 `host: none`） |
| 通道详情 | 无 | ssh: host/port/user/password；serial: port/baudRate；adb: serialNo |

因此本次工作不是"换数据源"，而是按真实 yaml 结构**重建数据模型与展示层**。现有 Mock 数据、`Device` 类型、`DeviceStatusBadge`、`DeviceCard` 的大部分逻辑将废弃或重写。

数据源依赖应用设置中的预置项 `embedded-mcp-toolkit` 的路径（见第三章 settings 改造）。该路径可能未配置或配置后指向不存在的目录，这两种情况都需在设备页给出明确引导。

## 二、目标

- 设备页改为读取 `embedded-mcp-toolkit` 路径下 `.embedded\configs\devices\` 目录内的 yaml 文件，动态生成设备列表
- 按真实 yaml 结构重建数据模型（设备名=文件名，以 ssh/serial/adb 通道为核心）
- 未配置或路径无效时，给出清晰提示并提供跳转至设置页的入口
- 设备卡片右侧提供「详情、复制、编辑、删除」四个操作按钮，行为分档实现（详情/复制可用，编辑/删除占位）
- 敏感字段（password 等）在列表中脱敏展示

## 三、功能需求

### F1：未配置路径时的引导态

当 `embedded-mcp-toolkit` 预置项的路径为空，或路径下 `.embedded\configs\devices\` 目录不存在时，设备页**不渲染设备列表**，而是渲染一个引导态：

- 展示提示文案，明确告知需要配置 `embedded-mcp-toolkit` 目录路径
- 提供一个跳转按钮，点击后切换到应用设置页（定位到目录配置）
- 引导态需覆盖两种子情况：路径为空、路径已填但目录不存在，文案可区分

### F2：读取并展示设备列表

当路径有效（目录存在）时：

- 读取该目录下所有 `.yaml` / `.yml` 文件
- 每个文件解析为一个设备，文件名（去掉扩展名）作为设备名称
- 设备以卡片形式列表展示，保留现有卡片"悬停淡入操作按钮"的交互骨架
- 列表标题区显示设备总数

### F3：设备数据模型（按真实 yaml 重建）

设备模型以通信通道为核心，反映真实 yaml 结构：

- 设备名：来自文件名
- ssh 通道：host、port、username、password、keyProvider 等（host 为 `none` 表示未启用）
- serial 通道：port、baudRate、loginUsername、loginPassword、keyProvider 等（port 为 `none` 表示未启用）
- adb 通道：serialNo（`sn_none` 或空表示未绑定）
- 各通道整体可选（yaml 中整段缺失视为该通道未配置）

### F4：设备卡片展示内容

每张卡片展示：

- 设备名（主标题）
- 各通信通道的连接摘要（如 SSH `user@host:port`、Serial `port@baudRate`、ADB 序列号），仅展示已启用通道
- 未启用的通道在卡片上以"未启用"标识或不展示
- password / loginPassword 等密钥字段在卡片上**脱敏**显示（以圆点 `·` 遮罩），不展示明文

### F5：操作按钮（四档）

卡片右侧操作区含四个按钮，统一悬停橙色高亮（对齐全站交互风格）：

- **详情**：点击弹出对话框（Modal），展示该设备的完整配置（所有通道的所有字段，对话框内可展示明文密码以便核对）
- **复制**：将该设备的**原始 yaml 全文**复制到系统剪贴板，复制成功有反馈
- **编辑**：本版仅占位——点击后给"功能开发中"类提示，不修改文件
- **删除**：本版仅占位——点击后给"功能开发中"类提示，不删除文件

### F6：解析容错

- 单个文件解析失败（格式错误、编码异常）时，不中断整体列表加载，跳过该文件并记录告警
- 目录读取失败、文件系统异常时，降级为引导态或空列表提示，不崩溃

## 四、非功能需求

- N1：依赖现有 Tauri fs 插件读取目录与文件，复用 settings 层已建立的 Tauri 环境降级机制（非 Tauri 环境不崩溃）
- N2：引入 `js-yaml` 作为 YAML 解析依赖
- N3：敏感字段不在卡片列表明文暴露，遵循最小信息展示原则
- N4：复用现有设置页的 `embedded-mcp-toolkit` 预置项作为路径来源，不重复建设配置入口

## 五、不做的事

- 不实现编辑写回 yaml（编辑按钮仅占位）
- 不实现删除真实文件（删除按钮仅占位）
- 不做设备"在线状态"检测（真实 yaml 无此概念，旧的状态徽章模型废弃）
- 不做设备类型图标（laptop/desktop/server 等不再适用）
- 不做目录监听/热更新，列表在进入页面时读取一次（后续章节再考虑刷新机制）
- 不做 i18n，文案本版硬编码中文

## 六、验收标准

- AC1：未配置 `embedded-mcp-toolkit` 路径时，设备页显示引导提示与跳转按钮；点击按钮跳转到设置页
- AC2：路径已填但目录不存在时，设备页显示区分性提示（区别于"未配置"）
- AC3：路径有效时，设备页展示 `.embedded\configs\devices\` 下所有 yaml 对应的设备卡片，数量与文件数一致
- AC4：设备名等于 yaml 文件名（去扩展名）；卡片展示已启用通道的连接摘要
- AC5：卡片上的 password 等密钥字段以 `·` 脱敏，不可见明文
- AC6：点击「详情」弹出对话框，展示该设备完整配置（含明文密码）
- AC7：点击「复制」后，剪贴板内容为该设备原始 yaml 全文
- AC8：点击「编辑」「删除」给出占位提示，不产生文件变更
- AC9：某个 yaml 格式错误时，列表仍正常加载其余设备，错误文件被跳过
- AC10：项目 `tsc` 编译通过，无类型错误
