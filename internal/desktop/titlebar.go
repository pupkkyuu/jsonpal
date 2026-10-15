package desktop

import (
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"

	"jsonpal/internal/editor"
	"jsonpal/locales"
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
			Label(locales.EditorToolbar()).MinWidth(0).Shrink(1).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Gap(t.Space(.5)).Children(func() {
				toolButton := func(action string, icon *ui.SVG, label string) ui.Element {
					tip := label
					if shortcuts, ok := app.activeTab.editor.(editor.ToolbarShortcuts); ok {
						if hint := shortcuts.ToolbarShortcut(action); hint != "" {
							tip = locales.WithShortcut(label, hint)
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
				if toolButton("format", lucide.Braces(), locales.FormatJSON()).Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Format()
				}
				if toolButton("compress", lucide.Minimize2(), locales.Compact()).Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Compact()
				}
				toolbarDivider(c.Key("transform-divider"))
				if toolButton("escape", lucide.FileCode(), locales.Escape()).Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Escape()
				}
				if toolButton("unescape", lucide.Code(), locales.Unescape()).Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.Unescape()
				}
				if toolButton("sort", lucide.ArrowDownAZ(), locales.SortFields()).Disabled(!canTransform).KeepFocus().Clicked() {
					app.activeTab.editor.SortFields()
				}
				toolbarDivider(c.Key("code-divider"))
				if toolButton("collapse", lucide.ChevronsDownUp(), locales.FoldAll()).KeepFocus().Clicked() {
					app.activeTab.editor.FoldAll()
				}
				if toolButton("expand", lucide.ChevronsUpDown(), locales.UnfoldAll()).KeepFocus().Clicked() {
					app.activeTab.editor.UnfoldAll()
				}
				wrap := toolButton("wrap", lucide.TextWrap(), locales.SoftWrap()).KeepFocus()
				if wrap.Clicked() {
					app.activeTab.editor.ToggleWrap()
				}
				wrap.Selected(app.activeTab.editor.WrapEnabled()).TextColor(t.TextMuted)
				if app.activeTab.editor.WrapEnabled() {
					wrap.Background(t.Text.Alpha(.1))
				}
				toolbarDivider(c.Key("document-divider"))
				if toolButton("search", lucide.Search(), locales.Search()).KeepFocus().Clicked() {
					app.activeTab.editor.Search()
				}
				canCopy := true
				if availability, ok := app.activeTab.editor.(editor.CopyAvailability); ok {
					canCopy = availability.CopyEnabled()
				}
				if toolButton("copy", lucide.Copy(), locales.Copy()).Disabled(!canCopy).KeepFocus().Clicked() {
					app.activeTab.editor.CopyAll(c.WriteClipboard)
				}
				if toolButton("clear", lucide.Trash(), locales.Clear()).KeepFocus().Clicked() {
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
