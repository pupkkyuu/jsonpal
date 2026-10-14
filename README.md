# JSONPal · MyGo 原生 Demo

JSONPal 使用 Go / MyGo 原生编辑器和 Onevra 组件库，仅面向 macOS 开发环境。没有 Web 前端，也不需要 Node.js 或 Bun。

## 已实现

- 使用 Onevra `shells/sidebar.NewShell` 管理窗口、浮动标题栏、侧栏、底部工具栏及内容区域。
- 默认窗口为 1000 × 650，最小 760 × 400；侧栏使用 Shell 默认宽度 220，可收起/展开、拖动调宽、键盘调宽及双击恢复默认宽度。
- Shell 的 `Left`、`LeftToolbar`、`ContentTitle` 和 `Content` 插槽分别承载导航、设置入口、文档标题和工具栏、JSON 编辑区。
- 按钮、文本、侧栏项、图标和滚动容器使用 Onevra components；所有图标使用组件库提供的 Lucide 资源，图标按钮使用 Shell 的 `IconButton`。
- 主题使用 Shell 默认的 `Auto`：跟随系统浅色/深色，使用 Onevra 默认调色板、字体和字重；没有应用自定义配色。
- JSON 编辑器沿用 MyGo 原生编辑能力和默认语法高亮，并继承 Shell 当前主题。Onevra 的 `components/code` 为只读代码展示，不替代可编辑 JSON 文档。
- 侧栏中的“新建格式化”“新建对比”和“格式化 1”统一使用 `components.SidebarItem` 的默认样式，保留标签数量和底部设置图标；新建、设置及新增工具按钮仍为占位。
- 工具栏在空间不足时横向滚动，使所有按钮仍可访问。
- 点击格式化图标或按 `⌘⇧F`，以 2 空格缩进格式化；只调整空白，保留字段顺序、数字原文与字符串转义。
- 格式化作为一次可撤销编辑；非法 JSON 和空输入保留原文本。结果记录在应用状态中，当前布局不展示底部结果提示。
- 剪切、复制、粘贴、全选、撤销、重做由原生编辑器提供。

暂缓功能见 [TODO](TODO.md)。旧版 Electron 的完整功能基线见 [迁移说明](docs/features-and-ui.zh-CN.md)，其中描述的是旧实现。

## macOS 开发启动

需要 Go **1.27.1 或更高版本**。项目固定使用 MyGo **0.4.8** 和 Onevra **v0.2026.8**，通过 `go.mod` 的 tool 指令运行 CLI，无需全局安装 MyGo。

```bash
go mod download
go tool mygo dev
```

首次运行会编译开发应用；窗口标题为 `JSONPal`。修改 Go 文件后开发进程重新编译并启动。退出应用或在终端按 `Ctrl+C` 停止。开发应用与缓存写入被 Git 忽略的 `.mygo/`。

环境检查：

```bash
go tool mygo doctor
```

仅供本机开发，也可以直接启动：

```bash
go run .
```

## 验证

```bash
go test ./...
go vet ./...
```

测试覆盖格式化结果、数字原文、Unicode 错误位置、非法输入保护，以及 MyGo 原生 UI 中的编辑、格式化图标按钮、快捷键、撤销，默认主题切换时的文档状态保留，以及窄工具栏滚动后首尾按钮的可访问性。

## 工程结构

```text
main.go         应用启动与 Onevra Sidebar Shell 窗口创建
app.go          Shell 插槽配置、原生编辑器及已有格式化逻辑
titlebar.go     文档标题、Lucide 工具按钮和横向滚动
sidebar.go      Onevra 导航、选中标签及底部设置入口
format.go       JSON 空白格式化与错误位置
*_test.go       格式化及原生 UI 交互测试
go.mod/go.sum   固定的 Go/MyGo 依赖
mygo.json       开发应用的最小名称、标识与版本信息
TODO.md         后续迁移功能
```

当前没有内容持久化，关闭窗口或开发热重启会丢失编辑内容。未添加发布打包、签名、公证、自动更新或 CI 配置；本轮不验证 Windows/Linux。

Onevra 组件库：[source](https://github.com/oneo-me/onevra)。

MyGo 文档：[安装与开发](https://mygo.egoist.dev/docs/getting-started#install)、[原生代码编辑器](https://mygo.egoist.dev/docs/ui/code-editor)。
