/**
 * =====================================================
 * Copyright © sumu. 2026-present. All rights reserved.
 * File name  : SettingsPage.tsx
 * Author     : sumu
 * Date       : 2026/07/21
 * Description: 设置页（目录配置）
 * ======================================================
 */

import { useCallback } from "react";

import { appDataDir, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, Plus } from "lucide-react";

import { DirectoryItemRow } from "@/components/DirectoryItemRow";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDirectoryConfig } from "@/hooks/useDirectoryConfig";
import { useToast } from "@/hooks/useToast";
import { STORE_FILE } from "@/config/settings";

/**
 * 设置页
 *
 * 渲染目录配置：用户可动态增删目录路径，支持手动输入与
 * 系统文件夹选择器两种录入方式，路径实时校验存在性，
 * 配置即时持久化到 Tauri Store。
 *
 * @returns 渲染后的页面元素
 */
export function SettingsPage(): React.ReactElement {
  const { items, isLoading, addItem, removeItem, updatePath, updateName } =
    useDirectoryConfig();
  const { show } = useToast();

  /**
   * 打开系统文件夹选择器
   *
   * 用户取消（返回 null）或异常时静默处理，不改变输入框内容。
   * 选中目录后通过 updatePath 即时保存并触发校验。
   */
  const handlePickDirectory = useCallback(
    async (id: string): Promise<void> => {
      try {
        const selected = await open({
          directory: true,
          title: "选择目录",
        });
        if (typeof selected === "string") {
          updatePath(id, selected);
        }
      } catch (error) {
        // 对话框异常（权限拒绝、插件未就绪等）静默降级
        console.warn("[SettingsPage] open directory failed:", error);
      }
    },
    [updatePath],
  );

  /**
   * 打开配置文件所在目录
   *
   * 通过 appDataDir 获取 Tauri Store 的数据目录
   * （Windows：%APPDATA%\com.tauri-app.toolkit-manager），
   * 拼接 settings.json 后用系统资源管理器打开并选中该文件，
   * 方便用户查看/备份配置文件。
   */
  const handleOpenConfigDir = useCallback(async (): Promise<void> => {
    try {
      const dir = await appDataDir();
      const filePath = await join(dir, STORE_FILE);
      await revealItemInDir(filePath);
    } catch (error) {
      console.warn("[SettingsPage] open config dir failed:", error);
      show("打开配置目录失败", "error");
    }
  }, [show]);

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div>
        <h2 className="text-xl font-semibold">应用设置</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          目录配置 · 管理应用关注的本地目录
        </p>
      </div>

      {/* 目录卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>目录配置</CardTitle>
              <CardDescription>
                添加应用需要访问的本地目录路径
              </CardDescription>
            </div>
            {/* 右侧按钮组：打开配置目录 + 新增目录 */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={handleOpenConfigDir}
                aria-label="打开配置目录"
                title="打开配置目录"
                className="hover:border-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={addItem}
                disabled={isLoading}
                aria-label="新增目录"
                title="新增目录"
                className="hover:border-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* 加载态 */}
          {isLoading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              加载中...
            </div>
          )}

          {/* 目录项列表 */}
          {!isLoading &&
            items.map((item, index) => (
              <DirectoryItemRow
                key={item.id}
                item={item}
                // 仅新增的用户自定义项（最后一项、非预置、路径为空）自动聚焦，
                // 避免空路径的预置项在每次加载时抢焦
                autoFocus={
                  index === items.length - 1 &&
                  !item.isPreset &&
                  item.path === ""
                }
                onNameChange={updateName}
                onPathChange={updatePath}
                onRemove={removeItem}
                onPickDirectory={handlePickDirectory}
              />
            ))}

          {/* 空状态 */}
          {!isLoading && items.length === 0 && (
            <div className="border border-dashed rounded-lg border-border px-6 py-8 text-center text-sm text-muted-foreground">
              暂无目录，点击右上角 + 添加
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
