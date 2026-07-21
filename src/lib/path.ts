/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : path.ts (lib)
 * Author     : sumu
 * Date       : 2026/07/22
 * Description: 路径处理工具（跨平台 basename 提取等）
 * ======================================================
 */

/**
 * 提取路径末尾段作为名称
 *
 * 按 / 和 \ 分割取最后非空段，兼容 Windows 与 Unix 路径。
 * 空路径或仅分隔符返回空字符串（由调用方转为"未命名"）。
 *
 * @param path - 完整路径
 * @returns 末尾段名称；无有效段时返回空字符串
 *
 * @example
 * basename("D:/foo/bar")  // "bar"
 * basename("C:\\Users")   // "Users"
 * basename("")            // ""
 */
export function basename(path: string): string {
  const segments = path.split(/[\\/]/);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i].trim();
    if (seg !== "") {
      return seg;
    }
  }
  return "";
}
