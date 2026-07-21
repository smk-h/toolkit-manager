# 我的初步想法

帮我重构设备管理页面的信息，需要解析设备页面 embedded-mcp-toolkit 这个目录配置项路径下的 .embedded\configs\devices 这个目录内的yaml文件，展示这里的设备信息。


- 没有配置 embedded-mcp-toolkit 的路径的时候，提示用户需要配置这一项，然后提供一个跳转按钮，点击后跳转到设置界面
- 已配置的时候，读取yaml文件并展示，展示卡片右侧包含 详情、复制、编辑、删除这几个按钮
