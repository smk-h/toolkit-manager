// 清理 tauri dev 残留进程
// 用法：pnpm kill-dev
// 作用：杀掉占用 1420 端口的 vite 进程 + 所有 toolkit-manager.exe 进程
// 场景：pnpm tauri dev 异常退出后，再次启动报"Port 1420 is already in use"

import { execSync } from "node:child_process";

/**
 * 执行 PowerShell 命令并返回输出
 * @param script - PowerShell 命令字符串
 * @returns 命令输出（失败返回空字符串）
 */
function runPowerShell(script) {
  try {
    return execSync(`powershell -NoProfile -Command "${script}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * 杀掉占用指定端口的进程
 * @param port - 端口号
 * @returns 被杀掉的进程 ID 数组
 */
function killProcessesOnPort(port) {
  // 查询占用端口的进程 ID
  const output = runPowerShell(
    `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
  );
  if (!output) {
    return [];
  }
  const pids = [...new Set(output.split(/\s+/).filter(Boolean))];
  for (const pid of pids) {
    runPowerShell(`Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`);
  }
  return pids;
}

/**
 * 杀掉指定名称的所有进程
 * @param name - 进程名（不带 .exe）
 * @returns 被杀掉的进程 ID 数组
 */
function killProcessesByName(name) {
  const output = runPowerShell(
    `Get-Process -Name '${name}' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id`,
  );
  if (!output) {
    return [];
  }
  const pids = [...new Set(output.split(/\s+/).filter(Boolean))];
  for (const pid of pids) {
    runPowerShell(`Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue`);
  }
  return pids;
}

console.log("🧹 清理 tauri dev 残留进程...\n");

// 1. 清理占用 1420 端口的进程（vite dev server）
const portPids = killProcessesOnPort(1420);
if (portPids.length > 0) {
  console.log(`✅ 端口 1420：已杀掉进程 ${portPids.join(", ")}`);
} else {
  console.log("⏭️  端口 1420：无占用");
}

// 2. 清理 toolkit-manager.exe 进程（cargo 编译产物）
const appPids = killProcessesByName("toolkit-manager");
if (appPids.length > 0) {
  console.log(`✅ toolkit-manager.exe：已杀掉进程 ${appPids.join(", ")}`);
} else {
  console.log("⏭️  toolkit-manager.exe：无运行实例");
}

console.log("\n清理完成，可重新执行 pnpm tauri dev");
