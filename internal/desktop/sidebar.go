package desktop

import (
	"fmt"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

func (app *application) sidebar(c *ui.Context) {
	t := c.Theme()
	closeID := ""
	ui.Column(c.Key("navigation")).Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {
		// New-document actions remain reachable while the tab list scrolls.
		components.Sidebar(c.Key("navigation-header")).Shrink(0).Children(func() {
			ui.Column(c.Key("sidebar-actions")).FillWidth().Gap(t.Space(1)).Children(func() {
				newFormat := sidebarItem(c.Key("new-format"), "新建格式化", lucide.Plus(), false)
				components.Tooltip(c, newFormat, "新建格式化（⌘N）")
				if newFormat.Clicked() {
					app.addFormatTab("")
				}
				if sidebarItem(c.Key("new-comparison"), "新建对比", lucide.FileDiff(), false).Clicked() {
					app.addComparisonTab("", "")
				}
			})
			components.SidebarSection(c.Key("tabs-heading"), fmt.Sprintf("标签页（%d）", len(app.tabs)), nil)
		})
		components.ScrollView(c.Key("tabs-scroll"), components.ScrollViewOptions{}).Label("标签列表").Grow(1).FillWidth().MinHeight(0).Children(func() {
			components.Sidebar(c.Key("tabs")).Gap(t.Space(1)).Children(func() {
				for _, tab := range app.tabs {
					row := ui.Row(c.Key("tab-row-" + tab.id)).FillWidth()
					row.Children(func() {
						item := sidebarItem(c.Key(tab.id), tab.title, nil, tab == app.activeTab).
							Padding(t.Space(1.75), t.Space(9), t.Space(1.75), t.Space(2))
						components.Tooltip(c, item, tab.title+"（切换标签：⌃Tab / ⌃⇧Tab）")
						if item.Clicked() {
							app.selectTab(tab.id)
						}
						if app.revealTab == tab.id {
							item.ScrollIntoView()
							app.revealTab = ""
						}
						// A sibling avoids nesting one interactive button inside another.
						close := sidebar.IconButton(c.Key("close-"+tab.id), lucide.X(), "关闭 "+tab.title).
							Size(t.Space(6), t.Space(6)).Absolute().Right(t.Space(1)).Top(t.Space(1)).KeepFocus()
						if !row.Hovered() {
							close.Invisible()
						}
						if close.Clicked() {
							closeID = tab.id
						}
					})
				}
			})
		})
	})
	// Mutate after all rows have been built so deletion cannot skip a row.
	if closeID != "" {
		app.closeTab(closeID)
		c.Invalidate()
	}
}

func sidebarItem(c *ui.Context, label string, icon *ui.SVG, selected bool) ui.Element {
	item := components.SidebarItem(c, label, icon, selected).KeepFocus()
	if !selected {
		t := c.Theme()
		item.Draw(func(p *ui.Painter, r ui.Rect) {
			if item.Hovered() && !item.IsDisabled() {
				// Match SidebarItem's selected background without changing selection.
				p.Fill(r, t.Text.Alpha(.1), t.Radius)
			}
		})
	}
	return item
}

func (app *application) sidebarFooter(c *ui.Context) {
	if sidebar.IconButton(c.Key("settings"), lucide.Settings(), "设置（⌘,）").Label("设置").KeepFocus().Clicked() {
		app.settings.Open()
	}
	ui.Spacer(c)
}
