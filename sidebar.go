package main

import (
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

func (app *application) sidebar(c *ui.Context) {
	t := c.Theme()
	components.ScrollView(c.Key("navigation-scroll"), components.ScrollViewOptions{}).
		Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).ScrollbarInsets(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {
		components.Sidebar(c.Key("navigation")).Children(func() {
			ui.Column(c.Key("sidebar-actions")).FillWidth().Gap(t.Space(1)).Children(func() {
				components.SidebarItem(c.Key("new-format"), "新建格式化", lucide.Plus(), false).KeepFocus().Clicked()
				components.SidebarItem(c.Key("new-comparison"), "新建对比", lucide.FileDiff(), false).KeepFocus().Clicked()
			})
			ui.Column(c.Key("tabs")).FillWidth().Gap(t.Space(1)).Children(func() {
				components.Text(c, "标签页（1）").TextColor(t.TextMuted).Padding(t.Space(1), t.Space(2)).SingleLine()
				if components.SidebarItem(c, "格式化 1", nil, app.selectedTab == "format-1").Clicked() {
					app.selectedTab = "format-1"
					app.editorFocus.Focus()
				}
			})
		})
	})
}

func (app *application) sidebarFooter(c *ui.Context) {
	sidebar.IconButton(c.Key("settings"), lucide.Settings(), "设置").KeepFocus().Clicked()
	ui.Spacer(c)
}
