// 将 package.json 的 version 同步到 src-tauri/tauri.conf.json 和 src-tauri/Cargo.toml
// 用法：pnpm sync-version
// 不做任何 git 操作，仅最小化修改目标文件（保留换行符、缩进、格式）
// 注意：package.json 的 version 由调用方负责修改，本脚本只读不改它

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const pkgPath = resolve(root, 'package.json');
const tauriConfPath = resolve(root, 'src-tauri/tauri.conf.json');
const cargoTomlPath = resolve(root, 'src-tauri/Cargo.toml');

// 工具函数：原地替换字符串中第一个匹配，未匹配到则抛错
function replaceOnce(text, regex, replacement, label) {
  const match = text.match(regex);
  if (!match) {
    throw new Error(`❌ ${label}：未找到匹配模式 ${regex}`);
  }
  // 校验仅匹配一次（用全文 match 计数）
  const all = text.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'));
  if (all && all.length > 1) {
    throw new Error(`❌ ${label}：匹配到 ${all.length} 处，应仅有 1 处`);
  }
  return text.replace(match[0], replacement);
}

// 1. 读取 package.json 的版本号（保留原文件格式，仅读取）
const pkgText = readFileSync(pkgPath, 'utf8');
const pkgVersionMatch = pkgText.match(/"version"\s*:\s*"([^"]+)"/);
if (!pkgVersionMatch) {
  console.error('❌ package.json 中未找到 version 字段');
  process.exit(1);
}
const version = pkgVersionMatch[1];
console.log(`源头版本号：package.json@${version}`);

// 2. 同步 tauri.conf.json：仅替换 "version": "..." 这一行，保留文件其余所有字节
const tauriText = readFileSync(tauriConfPath, 'utf8');
const tauriVersionRegex = /"version"\s*:\s*"[^"]+"/;
const oldTauriMatch = tauriText.match(tauriVersionRegex);
const oldTauri = oldTauriMatch ? oldTauriMatch[0].match(/"([^"]+)"$/)[1] : '(未找到)';
const newTauriText = replaceOnce(
  tauriText,
  tauriVersionRegex,
  `"version": "${version}"`,
  'tauri.conf.json',
);
if (newTauriText !== tauriText) {
  writeFileSync(tauriConfPath, newTauriText, 'utf8');
  console.log(`✅ src-tauri/tauri.conf.json: ${oldTauri} → ${version}`);
} else {
  console.log(`⏭️  src-tauri/tauri.conf.json: 已是 ${version}，无变化`);
}

// 3. 同步 Cargo.toml：仅替换 [package] 下 version = "..." 这一行
//    Cargo.toml 可能存在多个 version = （依赖里也有），因此限定行首位置
const cargoText = readFileSync(cargoTomlPath, 'utf8');
const cargoVersionRegex = /^version\s*=\s*"[^"]+"/m;
const oldCargoMatch = cargoText.match(cargoVersionRegex);
const oldCargo = oldCargoMatch ? oldCargoMatch[0].match(/"([^"]+)"/)[1] : '(未找到)';
const newCargoText = replaceOnce(
  cargoText,
  cargoVersionRegex,
  `version = "${version}"`,
  'Cargo.toml',
);
if (newCargoText !== cargoText) {
  writeFileSync(cargoTomlPath, newCargoText, 'utf8');
  console.log(`✅ src-tauri/Cargo.toml: ${oldCargo} → ${version}`);
} else {
  console.log(`⏭️  src-tauri/Cargo.toml: 已是 ${version}，无变化`);
}

console.log('\n同步完成。如需提交，请自行 git add 和 git commit。');
