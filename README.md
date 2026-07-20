## 一、 项目简介

本项目基于 Tauri 2 + React + TypeScript 构建，使用 Vite 作为前端构建工具。Tauri 让你可以用 Web 技术开发桌面应用，并通过 Rust 提供高性能的本地能力。

## 二、 快速开始

### 1. 环境要求

本项目编译与打包前，需准备以下环境：

| 工具 | 版本要求 | 用途 | 验证命令 |
| --- | --- | --- | --- |
| Node.js | ≥ 18 | 运行前端构建 | `node -v` |
| pnpm | ≥ 8 | 包管理器 | `pnpm -v` |
| Rust | ≥ 1.77 | 编译 Rust 后端 | `rustc --version` |
| MSVC C++ Build Tools | 含 `link.exe` 与 Windows SDK | Windows 下 Rust 的链接器依赖 | 安装 VS 2022 时勾选"使用 C++ 的桌面开发"工作负载 |
| WebView2 Runtime | — | 应用运行时界面渲染（Win10/11 通常自带） | — |

#### 1.1 Rust 工具链安装

下载并运行 [rustup-init.exe](https://www.rust-lang.org/tools/install)，安装完成后**重新打开终端**使 PATH 生效。

#### 1.2 MSVC 工具链安装

安装 [Visual Studio 2022](https://visualstudio.microsoft.com/) 或 [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，在安装器中勾选工作负载：**"使用 C++ 的桌面开发"**。

> Rust 在 Windows 上链接生成 exe 时依赖微软的 `link.exe`，该工具不在 Rust 安装包内，必须单独安装 MSVC 工具链。

### 2. 开发与构建

#### 2.1 安装依赖

```bash
pnpm install
```

#### 2.2 开发调试（热重载）

启动 Vite 前端（http://localhost:1420）与 Rust 后端，自动弹出应用窗口：

```bash
pnpm tauri dev
```

修改前端代码会自动刷新页面，修改 Rust 代码会自动重新编译。

#### 2.3 打包构建

##### 2.3.1 默认打包（同时生成 NSIS 与 MSI 安装包）

```bash
pnpm tauri build
```

##### 2.3.2 仅生成 NSIS 安装包

推荐方式，速度更快：

```bash
pnpm tauri build --bundles nsis
```

##### 2.3.3 仅生成 MSI 安装包

```bash
pnpm tauri build --bundles msi
```

##### 2.3.4 仅生成裸 exe（无安装程序）

运行时需系统已安装 WebView2 Runtime：

```bash
pnpm tauri build --no-bundle
```

> 首次编译会下载并编译大量 Rust 依赖（通常 5–15 分钟），后续构建会显著加速。

## 附录

### 1. 构建产物

执行 `pnpm tauri build` 后，所有产物位于 `src-tauri/target/` 目录下：

| 产物 | 路径 | 说明 |
| --- | --- | --- |
| 裸可执行文件 | `src-tauri/target/release/toolkit-manager.exe` | 直接运行需系统已安装 WebView2 Runtime |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/toolkit-manager_0.1.0_x64-setup.exe` | 推荐分发方式，带安装向导 |
| MSI 安装包 | `src-tauri/target/release/bundle/msi/toolkit-manager_0.1.0_x64_en-US.msi` | 适合企业/批量部署 |

### 2. 常见问题

#### 2.1 `error: linker 'link.exe' not found`

未安装 MSVC C++ Build Tools。请安装 Visual Studio 2022 并勾选"使用 C++ 的桌面开发"工作负载。

#### 2.2 `rustup` 或 `cargo` 命令找不到

安装 Rust 后需**重新打开终端**使 PATH 生效。对于 ZCode、VS Code 等宿主程序，需整体重启程序本身。

#### 2.3 首次 `cargo` 编译很慢

属正常现象（下载并编译大量依赖）。如需加速，可在 `~/.cargo/config.toml` 中配置 crates 国内镜像：

```toml
[source.crates-io]
replace-with = "ustc"

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
```

#### 2.4 应用启动后白屏

请确认系统已安装 WebView2 Runtime。Win10/11 通常自带，缺失时可在[微软官网](https://developer.microsoft.com/microsoft-edge/webview2/)下载安装。

### 3. 推荐的 IDE 配置

- [VS Code](https://code.visualstudio.com/)
- [Tauri 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer 插件](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

---
*本文档由 markdowncli 技能辅助生成*
