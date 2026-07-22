/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : device.ts (types)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 设备数据模型（以通信通道 ssh/serial/adb 为核心）
 * ======================================================
 */

/**
 * 密钥提供器（ssh/serial 通道共用）
 *
 * 描述密钥的获取方式与轮询参数，字段全部可选以兼容不同 yaml 写法。
 */
export interface KeyProvider {
  mode?: string;              // file: 通过文件 IPC 获取；terminal: 终端交互输入
  challengeFilePath?: string; // 挑战信息写入路径（相对运行时 cwd）
  keyFilePath?: string;       // 轮询密钥的文件路径（相对运行时 cwd）
  pollInterval?: number;      // 轮询间隔（毫秒）
  timeout?: number;           // 超时（毫秒）
}

/**
 * SSH 通道
 *
 * host 为 "none" 或整段缺失表示该设备未启用 SSH。
 */
export interface SshChannel {
  host?: string;        // 主机地址；"none" 表示未启用
  port?: number;        // 端口，默认 22
  username?: string;    // 登录用户名
  password?: string;    // 密码（敏感，列表脱敏）
  keyProvider?: KeyProvider;
}

/**
 * Serial 通道
 *
 * port 为 "none" 或整段缺失表示该设备未启用串口。
 * uboot 段本版不解析细节，原样保留为不透明对象。
 */
export interface SerialChannel {
  port?: string;            // 串口设备路径（如 COM3、/dev/ttyUSB0）；"none" 表示未启用
  baudRate?: number;        // 波特率，默认 115200
  loginUsername?: string;   // 串口登录用户名
  loginPassword?: string;   // 串口登录密码（敏感，列表脱敏）
  keyProvider?: KeyProvider;
  uboot?: Record<string, unknown>; // uboot 段，原样保留
}

/**
 * ADB 通道
 *
 * serialNo 为 "sn_none" 或空表示未绑定具体 ADB 设备。
 */
export interface AdbChannel {
  serialNo?: string; // ADB 序列号，sn_<序列号> 或 sn_none 表示未配置
}

/**
 * 设备数据模型
 *
 * 对应 `.embedded/configs/devices/` 下单个 yaml 文件。
 * 设备名取自文件名（去扩展名），以三个通信通道为核心。
 * rawYaml 保留原始文件文本，供复制与详情展示使用。
 */
export interface Device {
  name: string;              // 设备名（文件名去扩展名）
  filePath: string;          // YAML 文件完整路径，供写入与删除使用
  ssh?: SshChannel;          // SSH 通道，缺失表示未配置
  serial?: SerialChannel;    // Serial 通道，缺失表示未配置
  adb?: AdbChannel;          // ADB 通道，缺失表示未配置
  rawYaml: string;           // 原始文件文本，供复制与详情展示
}

/**
 * 设备列表加载状态（判别联合）
 *
 * 用 kind 字段区分五种态，便于 UI 穷尽分支渲染。
 */
export type DevicesStatus =
  | { kind: "loading" }           // 加载中
  | { kind: "no-path" }           // embedded-mcp-toolkit 路径为空
  | { kind: "dir-missing" }       // 路径已填但 devices 目录不存在
  | { kind: "ready"; devices: readonly Device[] } // 就绪，含设备列表
  | { kind: "error" };            // 读取异常（非 Tauri 环境等）
