## 一、 问题现象

在不同路径下配置 `embedded-mcp-toolkit` 后新建设备，表现出截然不同的结果：

- 配置路径为 `E:\AI\embedded-mcp-toolkit`（开发目录）：新建设备、填入字段、保存后，设备信息正常更新，磁盘上的 yaml 文件内容被正确修改。
- 配置路径为 `E:\01文件下载\edge\toolkit-manager-v0.1.2-windows-portable\embedded-mcp-toolkit-1.0.3-offline`（portable 包）：新建设备、填入字段、保存后，设备详情显示的仍是模板默认值（`192.168.16.105` / `root` / `22` 等），磁盘上实际创建的 yaml 文件与 `board-example.yaml` 模板**字节级完全一致**。

直观表现：在 portable 包路径下新建设备，表单里明明填了 IP、用户名、端口等，保存后"看起来成功了"，但打开设备详情全是模板默认值，磁盘上的文件也没被修改。**全程无任何报错或 toast 提示**。

## 二、 根因分析

### 1. 核心结论

**Windows 换行符（CRLF）导致行级正则失配，所有字段被静默跳过，新建设备文件退化为模板原文拷贝。**

### 2. 证据链

| 证据项 | 开发目录路径 | portable 包路径 |
|---|---|---|
| 模板换行符 | LF（`0a`） | CRLF（`0d 0a`） |
| 模板字节数 | 5335 | 5422（多出 87 字节，即 87 个 `\r`） |
| 新建设备文件对比模板 | 内容不同（已被修改） | `cmp` 确认字节级完全一致 |
| 字段替换测试 | 5 字段成功 apply | 5 字段全部 NOT FOUND，0 apply |

portable 包路径的 `board-example.yaml` 来自 Windows portable 安装包，在解压/打包过程中换行符被转换成了 CRLF。

### 3. 致命正则

行级解析使用的关键正则定义在 [`src/lib/devices.ts`](../src/lib/devices.ts#L263) 中：

```ts
// src/lib/devices.ts
const lineMatch = rawLine.match(
  /^(\s*)(\S[\w.-]*):(\s*)(.*)$/,
);
```

该正则在 CRLF 行 `"  host: \"192.168.16.105\" ...\r"` 上的失败机制如下：

1. 前半段 `^(\s*)(\S[\w.-]*):(\s*)(.*)` 能正常匹配。
2. 但末尾 `$` 锚点（未加 `m` flag）要求位置在字符串结尾。
3. 而 `.` 默认**会匹配 `\r`**（`\r` 不在 `.` 的排除字符 `\n` 中）。
4. 于是 `(.*)` 把行尾 `\r` 吃掉，`$` 在 `\r` 之后无位置可锚 → **整行匹配失败**。

### 4. 连锁失效路径

整个失效过程层层传递，且全程静默：

```
parseYamlLines：所有带值行正则失配 → continue 跳过
  → 索引 index 为空
    → applyFieldUpdates：每个字段都走 NOT FOUND 分支，仅 console.warn 不报错
      → createDeviceFromTemplate：applyFieldUpdates 返回值等于模板原文
        → 走"直接拷贝模板原文"分支，写出字节级副本
          → 全程无报错、无 toast
```

关键点：表单预填值用的是 `js-yaml` 的 `load()`（能正确处理 CRLF），所以**输入框里有值、看起来正常**；但保存时的行级替换用的是自研正则（无法处理 CRLF），导致**填了值却没存进去**——这正是"诡异表现"的来源。

## 三、 解决方案

采用**运行时归一化（核心修复）+ git 防御（规范约束）**双重保险。

### 1. 方案一：运行时换行符归一化（核心修复）

新增私有辅助函数 [`normalizeLineEndings()`](../src/lib/devices.ts#L222)，把 `\r\n` 与裸 `\r` 统一为 `\n`：

```ts
// src/lib/devices.ts
function normalizeLineEndings(text: string): string {
  // 先吃 \r\n（Windows），再兜底吃裸 \r（旧 Mac），两步顺序不可颠倒
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
```

在两处 `split("\n")` 之前对文本归一化：

- [`parseYamlLines()`](../src/lib/devices.ts#L237)：

  ```ts
  // src/lib/devices.ts
  const lines = normalizeLineEndings(yamlText).split("\n");
  ```

- [`applyFieldUpdates()`](../src/lib/devices.ts#L356)：

  ```ts
  // src/lib/devices.ts
  const normalized = normalizeLineEndings(rawText);
  const lines = normalized.split("\n");
  const index = parseYamlLines(normalized);  // 两处用同一份归一化文本，行号严格对齐
  ```

### 2. 方案二：git 属性配置（防御性约束）

新建 [`.gitattributes`](../.gitattributes)（本仓库原本无此文件），约束关键文本类型强制使用 LF：

```gitattributes
# .gitattributes
* text=auto eol=lf
*.yaml text eol=lf
*.yml  text eol=lf
*.json text eol=lf
*.{ts,tsx,js,jsx,mjs,mts,cjs} text eol=lf
```

与 `.editorconfig`（编辑器保存侧约束）呼应，补齐 git checkout/commit 侧的换行符归一化。

### 3. 边界说明

- 触发本次 bug 的 CRLF 模板位于**外部的** `embedded-mcp-toolkit-1.0.3-offline` portable 包，不在本仓库内，`.gitattributes` **无法约束它**。
- 因此**方案一是唯一能真正修复用户当前问题的手段**；方案二在本仓库仅作防御（防止未来引入 yaml 资源时复发 + 保持规范一致）。
- portable 包模板的打包侧根治需在 `embedded-mcp-toolkit` 项目处理，超出本次范围。

## 四、 验证结果

### 1. 逻辑验证

使用 portable 包路径的真实 CRLF 模板，复制改造后的纯逻辑进行对比测试：

| 指标 | 修复前 | 修复后 |
|---|---|---|
| CRLF 模板 scalar 行被解析数 | 0（全部跳过） | 正常解析 |
| 字段 apply 数 / notFound 数 | 0 / 5 | 8 / 0 |
| 输出是否等于模板原文 | 是（bug 现象） | 否（已修复） |
| 输出是否含 `\r` | — | 否（归一化为 LF） |
| 8 个字段是否全部正确写入 | — | 全部通过 |

核对覆盖的字段包括 `ssh.host` / `ssh.port` / `ssh.username` / `ssh.password` / `serial.port` / `serial.baudRate` / `serial.loginUsername` / `adb.serialNo`，全部正确写入。

### 2. 静态检查

- `tsc --noEmit`：exit 0，无类型错误。
- 临时验证脚本已清理，未进仓库。

### 3. 手动复测

执行以下命令进行端到端复测：

```bash
pnpm tauri dev
```

配置 portable 包路径 → 新增设备填入字段 → 保存 → 确认设备信息更新、文件被实际修改。

---
*本文档由 markdowncli 技能辅助生成*
