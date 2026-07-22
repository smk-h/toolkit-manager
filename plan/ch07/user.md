# 我的初步想法

当mcp安装目录确定后，还要为某一个项目配置mcp，需要在项目目录内配置`.claude/settings.local.json`和`.mcp.json`

`.claude/settings.local.json`中使能mcp，需要包含字段：

```json
{
  "enabledMcpjsonServers": [
    "embedded-board"
  ]
}
```

`.mcp.json`中包含了mcp的启动命令，mcp配置的路径中包含启动的bat脚本，所以可以像下面这样写：

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "mcpServers": {
    "embedded-board": {
      "command": "E:/AI/embedded-mcp-toolkit/remote-start-mcp.bat,
    }
  }
}
```

其中 `E:/AI/embedded-mcp-toolkit`这个路径是会在设置页面配置，不能写死，会在`settings.json`中记录：

```json
  "directory-config": [
    {
      "name": "embedded-mcp-toolkit",
      "path": "E:\\AI\\embedded-mcp-toolkit"
    }
  ]
```

需要从这里读，若是用户没有配置，和设备页面一样，要添加引导按钮，引导用户配置。

## 具体要求

（1）项目页面在全局Header区域，和设备页面一样，添加一个`新增项目`的按钮，要有鼠标悬浮效果，点击可以新增一个项目卡片，卡片按后面的要求开发。

（2）卡片左侧是路径输入框，输入框后面是一个打开路径按钮（要有鼠标悬浮效果），可以参考设置页面的打开文件操作，可以用户手动输入也可以点击打开按钮选择目录后自动填充，填充后检查是否存在上面说的两个文件以及相应字段，若文件存在且字段已配置，mcp路径也正常，则添加一个状态徽章，配置正常，显示OK，若是不存在这些文件或者字段则显示未配置状态，若是配置路径错误，则显示配置错误

（3）打开按钮后面是一个配置按钮，当项目配置状态不是OK的时候可以激活，有鼠标悬浮效果，点击后，创建文件或者添加字段或者修改路径，要是有其他字段在的话不能影响其他字段，当项目配置状态时OK的时候显示为灰色，表示已配置，不需要配置，用户不可点击，也没有悬浮效果

（4）对于用户输入的重复路径进行警告提示，不存在的路径也是警告提示，因为用户可能是想先初始化mcp然后再创建文件，当这种情况，点击了配置后创建目录并进行配置即可