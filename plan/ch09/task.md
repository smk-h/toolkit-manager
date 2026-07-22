# 配置文件手动刷新 Tasks

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/components/ProjectCard.tsx` | 状态检测 effect 依赖新增 refreshKey |
| 修改 | `src/pages/DevicesPage.tsx` | 监听 refreshTick 触发 reload |
| 修改 | `src/pages/ProjectsPage.tsx` | 透传 refreshKey 给 ProjectCard |
| 修改 | `src/components/Header.tsx` | 渲染刷新按钮 + 旋转动画 |
| 修改 | `src/components/ContentArea.tsx` | 透传 refreshTick |
| 修改 | `src/App.tsx` | 持有 refreshTick + handleRefresh + 透传 |

> 无新建文件,无新增依赖。全部为修改既有文件。

## T1: ProjectCard 状态检测响应刷新信号

**文件:** `src/components/ProjectCard.tsx`
**依赖:** 无
**步骤:**
1. 在 `ProjectCardProps` 接口(约第 25 行)新增字段:
   ```ts
   /** 刷新信号,变化时重新检测 MCP 状态(外部改了 .mcp.json 但路径未变时驱动重检测) */
   refreshKey: number;
   ```
2. 在 `ProjectCard` 函数签名解构新增 `refreshKey`(约第 101 行,与 `item, toolkitPath, ...` 同级)
3. 修改状态检测 effect 的依赖数组(约第 147 行):
   - 原:`}, [item.path, toolkitPath]);`
   - 改:`}, [item.path, toolkitPath, refreshKey]);`
   - effect 内部逻辑完全不变(空路径 idle → checking → 防抖 detectProjectStatus)
4. 更新 effect 上方注释(约第 124 行):「path、toolkitPath 或 refreshKey 变化时延迟检测」
5. 更新文件头 Description,追加「+ 手动刷新 refreshKey」

**验证:** `pnpm build` 编译通过;ProjectCard 接受 `refreshKey` prop

## T2: DevicesPage 监听刷新信号触发 reload

**文件:** `src/pages/DevicesPage.tsx`
**依赖:** 无(仅依赖既有 useDevices.reload)
**步骤:**
1. 在 `DevicesPageProps` 接口(约第 28 行)新增字段:
   ```ts
   /** 刷新计数器,>0 时触发 reload */
   refreshTick: number;
   ```
2. 在 `DevicesPage` 函数签名解构 `refreshTick`(约第 50 行)
3. 确认顶部已 import `useEffect`(当前仅 import `useState`,需补充):
   - 原:`import { useState } from "react";`
   - 改:`import { useEffect, useState } from "react";`
4. 在组件内(`const { status, reload } = useDevices();` 之后)新增 effect:
   ```tsx
   // 手动刷新:refreshTick 递增时重读设备配置
   // refreshTick 初始为 0,首次挂载不触发(避免与 useDevices 自身的挂载加载重复)
   // 故意不将 reload 纳入依赖:reload 来自 useCallback([]),引用稳定永不变化
   useEffect(() => {
     if (refreshTick > 0) {
       reload();
     }
   }, [refreshTick]);
   ```
5. 更新文件头 Description,追加「+ 手动刷新监听」

**验证:** `pnpm build` 编译通过;DevicesPage 接受 `refreshTick` prop 且 effect 逻辑正确

## T3: ProjectsPage 透传 refreshKey

**文件:** `src/pages/ProjectsPage.tsx`
**依赖:** T1(ProjectCard 需先接受 refreshKey)
**步骤:**
1. 在 `ProjectsPageProps` 接口(约第 23 行)新增字段:
   ```ts
   /** 刷新计数器,透传给 ProjectCard 作为 refreshKey */
   refreshTick: number;
   ```
2. 在 `ProjectsPage` 函数签名解构 `refreshTick`(约第 50 行)
3. 在 `<ProjectCard>` 渲染处(约第 160 行)新增 prop:
   - 原:`<ProjectCard key={item.id} item={item} toolkitPath={toolkitPath} ...`
   - 追加:`refreshKey={refreshTick}`
   ```tsx
   <ProjectCard
     key={item.id}
     item={item}
     toolkitPath={toolkitPath}
     refreshKey={refreshTick}
     isDuplicate={isDuplicatePath(item)}
     // ... 其余 prop 不变
   />
   ```
4. 更新文件头 Description,追加「+ 手动刷新透传」

**验证:** `pnpm build` 编译通过;ProjectsPage 接受 `refreshTick` 并透传给 ProjectCard

## T4: Header 渲染刷新按钮与旋转动画

**文件:** `src/components/Header.tsx`
**依赖:** 无
**步骤:**
1. 补充 import:
   - 原:`import { Plus } from "lucide-react";`
   - 改:`import { Plus, RefreshCw } from "lucide-react";`
   - 新增:`import { useState } from "react";`
   - 新增:`import { cn } from "@/lib/utils";`
2. 在 `HeaderProps` 接口(约第 18 行)新增字段:
   ```ts
   /** 刷新按钮点击回调 */
   onRefresh: () => void;
   ```
3. 在 `Header` 函数签名解构 `onRefresh`(约第 44 行)
4. 在组件内新增旋转动画状态与点击处理:
   ```tsx
   // 刷新按钮旋转动画:纯视觉反馈,与实际数据加载解耦
   const [isRefreshing, setIsRefreshing] = useState(false);
   const handleRefreshClick = (): void => {
     setIsRefreshing(true);
     onRefresh();
     // 固定时长后停止动画(数据读取通常 <100ms,500ms 给足视觉感知)
     setTimeout(() => setIsRefreshing(false), 500);
   };
   ```
5. 在 devices 分支(`activeTab === "devices"`,约第 62 行)的「新增设备」按钮**前**插入刷新按钮:
   ```tsx
   {activeTab === "devices" && (
     <>
       <Button
         onClick={handleRefreshClick}
         variant="ghost"
         size="sm"
         aria-label="刷新设备列表"
         title="刷新设备列表"
         className="hover:bg-orange-500 hover:text-white"
       >
         <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
         刷新
       </Button>
       <Button
         onClick={onAddDevice}
         variant="ghost"
         size="sm"
         className="hover:bg-orange-500 hover:text-white"
       >
         <Plus className="h-4 w-4" />
         新增设备
       </Button>
     </>
   )}
   ```
6. 在 projects 分支(`activeTab === "projects"`,约第 74 行)的 `GlobalMcpSwitch` 与「新增项目」按钮**之间**插入纯图标刷新按钮:
   ```tsx
   {activeTab === "projects" && (
     <>
       <GlobalMcpSwitch
         checked={globalMcpChecked}
         onCheckedChange={onGlobalMcpToggle}
       />
       <Button
         onClick={handleRefreshClick}
         variant="ghost"
         size="icon"
         aria-label="刷新项目列表"
         title="刷新项目列表"
         className="hover:bg-orange-500 hover:text-white"
       >
         <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
       </Button>
       <Button
         onClick={onAddProject}
         variant="ghost"
         size="sm"
         className="hover:bg-orange-500 hover:text-white"
       >
         <Plus className="h-4 w-4" />
         新增项目
       </Button>
     </>
   )}
   ```
7. 更新文件头 Description,追加「+ 手动刷新按钮」

**验证:** `pnpm build` 编译通过;Header 接受 `onRefresh` prop,devices/projects 分支各有一个刷新按钮

## T5: ContentArea 透传 refreshTick

**文件:** `src/components/ContentArea.tsx`
**依赖:** 无
**步骤:**
1. 在 `ContentAreaProps` 接口(约第 19 行)新增字段:
   ```ts
   /** 刷新计数器,透传给当前页签页面 */
   refreshTick: number;
   ```
2. 在 `renderPage` 函数签名(约第 49 行)新增参数 `refreshTick: number`
3. 在 `renderPage` 的 devices 分支(约第 60 行)透传给 DevicesPage:
   - 在 `<DevicesPage ... />` 内追加 `refreshTick={refreshTick}`
4. 在 `renderPage` 的 projects 分支(约第 68 行)透传给 ProjectsPage:
   - 在 `<ProjectsPage ... />` 内追加 `refreshTick={refreshTick}`
5. 在 `renderPage` 的 default 兜底分支(约第 83 行)同样透传给 DevicesPage(与 devices 分支一致)
6. 在 `ContentArea` 函数签名解构 `refreshTick`(约第 100 行)
7. 在 `ContentArea` 调用 `renderPage` 处(约第 120 行)传入 `refreshTick`:
   - 原:`{renderPage(activeTab, onSwitch, createOpen, onCreateClose, projectCreateOpen, onProjectCreateClose, globalMcpChecked)}`
   - 改:末尾追加 `, refreshTick`
8. 更新 `renderPage` 上方 JSDoc(约第 38 行),补充 `@param refreshTick` 说明

**验证:** `pnpm build` 编译通过;ContentArea 接受并透传 `refreshTick`

## T6: App 持有 refreshTick 并编排刷新

**文件:** `src/App.tsx`
**依赖:** T2、T3、T4、T5(收口任务)
**步骤:**
1. 在组件内(约第 65 行 `globalMcpChecked` state 附近)新增 refreshTick 状态:
   ```tsx
   // 手动刷新计数器:Header 按钮点击时递增,驱动当前页签重读外部配置
   const [refreshTick, setRefreshTick] = useState<number>(0);
   ```
2. 新增 `handleRefresh` useCallback:
   ```tsx
   /**
    * 手动刷新当前页签数据 + 全局 MCP 状态
    *
    * 递增 refreshTick 驱动当前页签重读外部配置文件(设备 YAML / 项目 MCP 状态),
    * 同时重读 ~/.claude.json 刷新全局 MCP 开关状态。
    * 全局 MCP 重读失败时静默降级,不阻断页面数据刷新。
    */
   const handleRefresh = useCallback(async (): Promise<void> => {
     setRefreshTick((t) => t + 1);
     try {
       const status = await detectGlobalMcp();
       setGlobalMcpChecked(status.kind === "enabled");
     } catch (error) {
       console.warn("[App] refresh global mcp failed:", error);
     }
   }, []);
   ```
3. 在 `<Header>` 渲染处(约第 159 行)新增 prop:
   ```tsx
   <Header
     activeTab={activeTab}
     onAddDevice={() => setCreateOpen(true)}
     onAddProject={() => setProjectCreateOpen(true)}
     globalMcpChecked={globalMcpChecked}
     onGlobalMcpToggle={handleGlobalMcpToggle}
     onRefresh={handleRefresh}
   />
   ```
4. 在 `<ContentArea>` 渲染处(约第 167 行)新增 prop:
   ```tsx
   <ContentArea
     activeTab={activeTab}
     onSwitch={setActiveTab}
     createOpen={createOpen}
     onCreateClose={() => setCreateOpen(false)}
     projectCreateOpen={projectCreateOpen}
     onProjectCreateClose={() => setProjectCreateOpen(false)}
     globalMcpChecked={globalMcpChecked}
     refreshTick={refreshTick}
   />
   ```
5. 更新文件头 Description,追加「+ 手动刷新编排」

**验证:** `pnpm build` 编译通过;从 Header 按钮到页面重读的完整链路打通

## 集成验证

**步骤:**
1. 运行 `pnpm tauri:dev` 启动应用
2. 设备页:在编辑器中修改某设备 YAML(改字段或增删文件)→ 点击 Header 刷新按钮 → 观察设备列表立即更新 + 图标旋转
3. 项目页:在编辑器中修改某项目的 `.mcp.json`(如删除 embedded-board 字段)→ 点击刷新 → 观察项目卡片徽章从 OK 变为「未配置」
4. 项目页:在编辑器中修改 `~/.claude.json` 的 embedded-board → 点击刷新 → 观察全局开关颜色变化
5. 切换到设置页/关于页 → 确认 Header 无刷新按钮

**验证:** 上述 5 个场景全部符合预期

## 执行顺序

```
T1(ProjectCard refreshKey)──┐
T2(DevicesPage reload)──────┤
T4(Header 按钮)─────────────┼──> T6(App 收口)──> 集成验证
T5(ContentArea 透传)────────┤
T3(ProjectsPage 透传)───────┘
  │
  └─ T3 依赖 T1(ProjectCard 需先接受 refreshKey)
```

- T1 / T2 / T4 / T5 相互独立,可任意顺序
- T3 依赖 T1(ProjectsPage 传 refreshKey 给 ProjectCard,需 ProjectCard 先支持该 prop)
- T6 依赖全部,是收口任务
