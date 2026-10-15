package desktop

import (
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
	"jsonpal/internal/editor"
)

func (app *application) titlebar(c *ui.Context) {
	t := c.Theme()
	if app.activeTab == nil {
		components.Text(c, "JSONPal").SingleLine()
		return
	}
	ui.Row(c.Key("document-header")).Fill().AlignItems(ui.Center).Gap(t.Space(2)).Children(func() {
		components.Text(c, app.activeTab.title).SingleLine().Shrink(0)
		ui.Spacer(c)
		// Horizontal scrolling keeps every action reachable in a narrow header.
		components.ScrollView(c.Key("editor-tools"), components.ScrollViewOptions{Axes: components.ScrollHorizontal}).
			Label("编辑工具栏").MinWidth(0).Shrink(1).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Gap(t.Space(.5)).Children(func() {
				toolButton := func(action string, icon *ui.SVG, label string) ui.Element {
					tip := label
					if shortcuts, ok := app.activeTab.editor.(editor.ToolbarShortcuts); ok {
						if hint := shortcuts.ToolbarShortcut(action); hint != "" {
							tip += "（" + hint + "）"
						}
					}
					return sidebar.IconButton(c.Key(action), icon, tip).Label(label)
				}
				if toolbar, ok := app.activeTab.editor.(editor.Toolbar); ok {
					toolbar.Toolbar(c.Key("type-tools"))
				}
				canTransform := true
				if availability, ok := app.activeTab.editor.(editor.TransformAvailability); ok {
					canTransform = availability.TransformEnabled()
				}
				if toolButton("format", lucide.Braces(), "格式化 JSON").Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Format()
				}
				if toolButton("compress", lucide.Minimize2(), "压缩").Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Compact()
				}
				toolbarDivider(c.Key("transform-divider"))
				if toolButton("escape", lucide.FileCode(), "转义").Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Escape()
				}
				if toolButton("unescape", lucide.Code(), "去转义").Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Unescape()
				}
				if toolButton("sort", lucide.ArrowDownAZ(), "字段排序").Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.SortFields()
				}
				toolbarDivider(c.Key("code-divider"))
				if toolButton("collapse", lucide.ChevronsDownUp(), "全部折叠").KeepFocus().Clicked() {
					app.activeTab.editor.FoldAll()
				}
				if toolButton("expand", lucide.ChevronsUpDown(), "全部展开").KeepFocus().Clicked() {
					app.activeTab.editor.UnfoldAll()
				}
				wrap := toolButton("wrap", lucide.TextWrap(), "自动换行").KeepFocus()
				if wrap.Clicked() {
					app.activeTab.editor.ToggleWrap()
				}
				wrap.Selected(app.activeTab.editor.WrapEnabled()).TextColor(t.TextMuted)
				if app.activeTab.editor.WrapEnabled() {
					wrap.Background(t.Text.Alpha(.1))
				}
				toolbarDivider(c.Key("document-divider"))
				if toolButton("search", lucide.Search(), "搜索").KeepFocus().Clicked() {
					app.activeTab.editor.Search()
				}
				canCopy := true
				if availability, ok := app.activeTab.editor.(editor.CopyAvailability); ok {
					canCopy = availability.CopyEnabled()
				}
				if toolButton("copy", lucide.Copy(), "复制").Disabled(!canCopy).KeepFocus().Clicked() {
					app.activeTab.editor.CopyAll(c.WriteClipboard)
				}
				if toolButton("clear", lucide.Trash(), "清空").KeepFocus().Clicked() {
					app.activeTab.editor.Clear()
				}
			})
		})
	})
}

func toolbarDivider(c *ui.Context) {
	t := c.Theme()
	ui.Box(c).Size(1, t.Rem(1.25)).Margin(0, t.Space(.5)).Background(t.Border)
}
