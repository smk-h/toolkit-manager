# 全局 MCP 配置开关 Spec

## 背景

当前应用已支持项目级 MCP 配置（ch07）：为每个项目在项目目录下写入 `.mcp.json` 与 `.claude/settings.local.json`，使 embedded-board server 对该项目生效。

但 Claude Code 还支持全局 MCP 配置——在 `~/.claude.json` 的 `mcpServers` 中定义 server，对该用户的所有项目生效，且**无需** `enabledMcpjsonServers` 白名单（用户自己写的全局配置天然可信）。

当全局已启用 embedded-board 时，项目级配置就变得冗余（同一个 server 重复定义）。因此需要提供一个全局开关，让用户在「全局对所有项目生效」与「逐项目配置」两种模式间切换，并联动禁用/恢复项目级配置入口，避免重复配置造成困惑。

## 目标

- 在项目页 Header 区域提供全局 MCP 配置的拨动开关，直观呈现当前模式
- 开关开启时写入 `~/.claude.json`，关闭时移除，且字段级操作不破坏其他 server
- 开关状态与项目级配置按钮联动：开启时禁用所有项目配置按钮，关闭时恢复
- 两个方向的切换都需用户确认，明确告知对项目级配置的影响

## 功能需求

- **F1（开关入口）**：项目页激活时，Header 右侧显示「全局 MCP」拨动开关（带 label 文案），位于「新增项目」按钮左侧；开关具备开启（绿色）/关闭（灰色）两态视觉
- **F2（状态检测）**：开关状态依据 `~/.claude.json` 的 `mcpServers` 是否含 `embedded-board` 判定；含则为开，不含则为关
- **F3（开启操作）**：开关处于关态时，用户拨向开，弹出确认对话框告知「将禁用项目级配置按钮」；确认后向 `~/.claude.json` 写入 `mcpServers.embedded-board.command`（command 为 `${toolkit}/remote-start-mcp.bat`），写入成功后开关变为开态并 toast 提示；取消则开关回弹为关态
- **F4（关闭操作）**：开关处于开态时，用户拨向关，弹出确认对话框告知「将恢复项目级配置能力」；确认后从 `~/.claude.json` 移除 `mcpServers.embedded-board`（仅删该 key，不碰其他 server），移除成功后开关变为关态并 toast 提示；取消则开关回弹为开态
- **F5（项目配置联动）**：开关处于开态时，所有项目卡片的「配置」按钮变灰禁用、无悬浮效果、不可点击；开关处于关态时恢复为原本逻辑（按各项目自身状态决定可用性）
- **F6（toolkit 依赖）**：开关的可用性依赖 toolkit 路径正常；toolkit 路径未配置或不存在时（即项目页处于引导态），开关不显示（与项目卡片一同被引导态替代）
- **F7（取消回弹）**：无论开启还是关闭，用户在确认对话框点击「取消」时，开关视觉状态回弹到操作前的状态，不产生任何文件改动

## 非功能需求

- **N1**：字段级合并——写入与移除均不得破坏 `~/.claude.json` 中其他既有字段（其他 server、其他顶层配置项）
- **N2**：JSON 读写健壮性——`~/.claude.json` 不存在、解析失败、字段缺失等情况不抛错，读取按空对象处理，写入前确保结构存在
- **N3**：Tauri 环境降级——非 Tauri 环境下文件读写静默降级，开关显示为关态且不可操作
- **N4**：复用项目既有模式——复用 `buildMcpCommand`（command 正斜杠归一）、Dialog 组件、Toast 全局单例、判别联合状态分流
- **N5**：遵循项目编码规范（文件头注释、TypeScript 语言规范）

## 不做的事

- 不管理 `~/.claude.json` 中除 embedded-board 之外的其他 server
- 不支持自定义 command（固定为 `${toolkit}/remote-start-mcp.bat`）
- 不做全局配置的 server 列表浏览/编辑（仅 embedded-board 单 server 的开关）
- 不在引导态（toolkit 未配置）时显示开关
- 不将全局配置状态持久化到应用 settings.json（状态唯一来源是 `~/.claude.json` 本身，避免双源不一致）

## 验收标准

- **AC1（对应 F1）**：切换到项目页时，Header 右侧出现「全局 MCP」拨动开关，位于「新增项目」按钮左侧；开关有开（绿）/关（灰）两种视觉态
- **AC2（对应 F2）**：`~/.claude.json` 含 `mcpServers.embedded-board` 时开关显示为开；不含时显示为关
- **AC3（对应 F3）**：开关处于关态时拨向开，弹出确认对话框；点「启用」后 `~/.claude.json` 写入 `mcpServers.embedded-board.command` 且值正确（`${toolkit}/remote-start-mcp.bat`，纯正斜杠），开关变开态，toast 提示成功
- **AC4（对应 F4）**：开关处于开态时拨向关，弹出确认对话框；点「关闭」后 `~/.claude.json` 的 `mcpServers.embedded-board` 被移除，其他 server 保留，开关变关态，toast 提示成功
- **AC5（对应 F5）**：开关开态下，所有项目卡片的「配置」按钮灰色不可点、无悬浮效果；关态下恢复为原本按项目状态决定的可用性
- **AC6（对应 F6）**：toolkit 路径未配置或不存在时（项目页引导态），Header 不显示全局 MCP 开关
- **AC7（对应 F7）**：开启或关闭的确认对话框点「取消」时，开关回弹到操作前状态，`~/.claude.json` 内容不变
- **AC8（对应 N1）**：`~/.claude.json` 中预先存在的其他 server 与其他顶层字段，在开关操作后保持不变
- **AC9（对应 N2）**：`~/.claude.json` 不存在或内容非法 JSON 时，开关显示为关态，页面不崩溃；点开启后能正常创建文件并写入配置
