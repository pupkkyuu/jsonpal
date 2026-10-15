# 代码结构与组织规范

项目按 Go 的 `cmd` / `internal` 惯例组织。根目录保留模块配置、开发配置和项目文档，应用代码按职责放入包中。

## 模块职责

| 目录 | 职责 | 对外接口 |
|---|---|---|
| `cmd/jsonpal` | 可执行程序入口，启动应用并处理退出错误 | `main` |
| `internal/desktop` | 原生窗口生命周期、工作区导航、工具栏、编辑器宿主及设置入口 | `Run` |
| `internal/editor` | 编辑器接口与 JSON 实现，拥有文档状态、渲染、操作、主题和校验调度 | `Editor`、`ViewOptions`、`Result`、`JSON`、`NewJSON` |
| `internal/diffeditor` | 双文档输入、原生差异预览、模式切换及双侧操作 | `Diff`、`New` |
| `internal/setting` | 设置面板、分类、主题偏好及选择交互 | `Panel`、`NewPanel` |
| `internal/jsondoc` | JSON 格式化、压缩、排序、转义、校验及错误定位，不依赖 UI | `Format`、`Compact`、`SortFields`、`Escape`、`Unescape`、`Validate`、`DiagnosticsForError`、`Diagnostic` |
| `docs` | 当前工程说明及历史迁移资料 | — |

依赖方向为 `cmd/jsonpal → internal/desktop`，桌面层依赖 `editor`、`diffeditor` 和 `setting`；`diffeditor → editor → jsondoc`，对比编辑器还直接调用 `jsondoc` 来预计算双侧变换。编辑器与设置包不依赖桌面层。MyGo 用于桌面界面与编辑器；Onevra 负责桌面组件与设置布局；JSON 处理模块只使用 Go 标准库。

`desktop.workspaceTab` 只包含 ID、名称和 `editor.Editor` 引用，负责导航身份。编辑器独立于标签，自己拥有文档、撤销、选区、滚动、查找、折叠、焦点和操作结果。桌面层通过 `Editor.View` 提供布局上下文、稳定身份和焦点/快捷键选项，通过 `Format` / `Compact` 变换文档，通过 `FoldAll` / `UnfoldAll` 折叠或展开视图，通过 `Result` 获取操作结果。

应用初始没有标签或活动编辑器，由 `desktop/welcome.go` 渲染欢迎背景；创建标签后才挂载其编辑器视图。欢迎页属于工作区布局，不是一种编辑器类型。图标背景直接绘制，Lucide 资源仅解析一次，并裁剪在内容区域内。编辑交互测试显式创建文档，启动测试则验证空工作区及首次创建行为。

`editor.JSON` 是单文档实现，`State()` 提供其 MyGo 原生编辑能力。`diffeditor.Diff` 在同一接口下组合两份 JSON 编辑器，并保留一个直接引用原缓冲区的 `mygoeditor.DiffState`；通用 `Editor` 接口不暴露单一 buffer，也不要求具体 JSON 类型。差异预览当前只读，双侧输入模式负责修改。

不同编辑器的附加工具通过可选的 `editor.Toolbar` 接口插入工具栏，文档变换的可用性通过 `TransformAvailability` 接口控制；桌面层不判断具体对比类型。`JSON.ApplyText` 和 `ReportError` 提供准备好的文本提交与诊断入口，使双侧操作能先验证全部结果，再提交两边的可撤销修改。

全文复制按钮通过可选的 `CopyAvailability` 接口控制可用性；默认启用，对比编辑器始终禁用。原生编辑器的选区复制快捷键保持原有行为。

可选的 `ToolbarShortcuts` 接口提供当前模式下与工具栏操作等价的快捷键提示；桌面层只组合 tooltip 文本，保留原有控件标签。`editor.FindBar` 通过 MyGo 的 `RenderFindBar` 扩展点沿用默认布局并补充提示，查找、替换、焦点与按键处理仍交由原生编辑器。桌面层保留创建后的 Shell 引用，侧栏按钮和 `⌘B` 共享 Shell 的展开状态，避免各自维护状态而不同步。

工具栏的转义、去转义、排序、清空、全文复制、自动换行与搜索也通过 `Editor` 接口调用。全文复制接收宿主的剪贴板写入函数，不改动选区；搜索使用原生编辑器命令。`WrapEnabled` 返回当前换行偏好，工具栏据此绘制激活背景；按钮与原生换行快捷键都更新公开的 `SoftWrap` 配置，避免原生私有开关与按钮状态不同步。文档操作共用撤销、位置重置和诊断更新流程；解码结果为普通文本时，操作成功但仍显示该文本的 JSON 校验诊断。

编辑器包负责将 `jsondoc.Diagnostic` 转换为 MyGo 诊断，并处理防抖、后台任务、文档版本保护和校验刷新。JSON 校验规则和 UTF-8 错误定位属于 JSON 处理层；标签创建/切换和窗口生命周期属于桌面层。

`setting.Panel` 自己管理打开状态、设置导航和当前主题偏好；桌面层通过 `Open` 打开、`IsOpen` 判断模态状态、`View` 渲染。`Appearance` 返回当前偏好。桌面层注入 `mygo.Theme.SetSource`，设置包不直接修改全局主题。面板关闭后仍保留当前会话内的选择。

## 新代码的放置规则

- 应用入口保持简短；窗口初始化和应用生命周期放在 `internal/desktop/window.go`。
- 窗口级共享状态保留在 `desktop/app.go`；标签只持有导航信息和编辑器引用，不持有文档或校验状态。
- 标签关闭及邻居选择由 `desktop/tabs.go` 处理。关闭按钮与导航按钮为同级控件，避免关闭非活动标签时先激活；删除在标签列表构建后执行，最后一项关闭时创建新的空白编辑器。
- 设置面板状态与布局放在 `setting/panel.go`，主题分类与选择交互放在 `setting/appearance.go`。新增设置项放入设置包，通过明确的宿主回调应用需要影响应用的变更。
- 格式化、排序、转义等不需要界面的 JSON 操作放在 `internal/jsondoc`，由编辑器层调用。
- 编辑器的文档状态和渲染放在 `editor/json.go`，文档操作放在 `editor/actions.go`，共用文档更新、撤销及即时诊断流程。主题与校验调度分别放在 `theme.go` 和 `diagnostics.go`。
- 折叠操作放在 `editor/folding.go`，使用原生编辑器命令。它们只改变视图，不经过文档变换流程、不新增撤销记录。
- 换行和查找入口分别放在 `editor/wrapping.go` 与 `editor/search.go`。换行偏好由编辑器管理，保留原生组合快捷键及同前缀的其他命令。纯文本转义与字段排序分别放在 `jsondoc/escape.go` 与 `jsondoc/sort.go`，排序不通过 map/float64 改写数据。
- 新的编辑器类型在独立功能包中实现 `editor.Editor` 接口，如 `internal/diffeditor`。桌面工具栏和内容宿主依赖接口，避免断言具体类型或访问编辑器内部状态。
- 先按功能拆文件；当功能有明确的独立职责和可复用接口时再拆包，避免每个控件都建立一个包。
- 类型和函数默认保持包内私有，只导出跨包需要的接口。内部实现放在 `internal` 下，不作为外部依赖公开。
- 测试与被测代码放在同一个目录，使用 `*_test.go`；UI 测试与纯 JSON 测试分开。
- 临时预览、编译产物和开发缓存不放入源码目录，开发缓存由 `.gitignore` 排除。

## 启动与验证

`mygo.json` 的 `main` 指向 `./cmd/jsonpal`，开发命令仍从根目录运行：

```bash
go tool mygo dev
```

直接运行和验证：

```bash
go run ./cmd/jsonpal
go test ./...
go test -race ./...
go vet ./...
go build -o build/jsonpal ./cmd/jsonpal
```
