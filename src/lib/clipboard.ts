/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : clipboard.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 剪贴板复制封装（navigator.clipboard 优先 + execCommand 兜底）
 * ======================================================
 */

/**
 * 复制文本到系统剪贴板
 *
 * 降级链：
 * 1. 优先 navigator.clipboard.writeText（Tauri webview 支持，无需额外插件）
 * 2. 失败时降级 document.execCommand('copy')（创建临时 textarea 选区复制）
 *
 * @param text - 待复制文本
 * @returns 复制成功返回 true，失败返回 false
 */
export async function copyText(text: string): Promise<boolean> {
  // 优先现代 Clipboard API
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn("[clipboard] navigator.clipboard failed:", error);
  }

  // 降级 execCommand（兼容旧 webview / 非安全上下文）
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // 移出视口避免页面跳动
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (error) {
    console.warn("[clipboard] execCommand failed:", error);
    return false;
  }
}
