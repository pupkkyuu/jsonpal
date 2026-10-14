package main

import (
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

func (app *application) titlebar(c *ui.Context) {
	t := c.Theme()
	ui.Row(c.Key("document-header")).Fill().AlignItems(ui.Center).Gap(t.Space(2)).Children(func() {
		components.Text(c, "格式化 1").SingleLine().Shrink(0)
		ui.Spacer(c)
		// Horizontal scrolling keeps every action reachable in a narrow header.
		components.ScrollView(c.Key("editor-tools"), components.ScrollViewOptions{Axes: components.ScrollHorizontal}).
			Label("编辑工具栏").MinWidth(0).Shrink(1).Children(func() {
			ui.Row(c).AlignItems(ui.Center).Gap(t.Space(.5)).Children(func() {
				if sidebar.IconButton(c.Key("format"), lucide.Braces(), "格式化 JSON").KeepFocus().Clicked() {
					app.format()
				}
				sidebar.IconButton(c.Key("compress"), lucide.Minimize2(), "压缩").KeepFocus().Clicked()
				toolbarDivider(c.Key("transform-divider"))
				sidebar.IconButton(c.Key("collapse"), lucide.ChevronsDownUp(), "全部折叠").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("expand"), lucide.ChevronsUpDown(), "全部展开").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("wrap"), lucide.TextWrap(), "自动换行").KeepFocus().Clicked()
				toolbarDivider(c.Key("code-divider"))
				sidebar.IconButton(c.Key("escape"), lucide.FileCode(), "转义").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("unescape"), lucide.Code(), "去转义").KeepFocus().Clicked()
				toolbarDivider(c.Key("document-divider"))
				sidebar.IconButton(c.Key("copy"), lucide.Copy(), "复制").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("sort"), lucide.ArrowDownAZ(), "字段排序").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("search"), lucide.Search(), "搜索").KeepFocus().Clicked()
				sidebar.IconButton(c.Key("clear"), lucide.Trash(), "清空").KeepFocus().Clicked()
			})
		})
	})
}

func toolbarDivider(c *ui.Context) {
	t := c.Theme()
	ui.Box(c).Size(1, t.Rem(1.25)).Margin(0, t.Space(.5)).Background(t.Border)
}
