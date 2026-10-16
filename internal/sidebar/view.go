package sidebar

import (
	"jsonpal/locales"
	"strconv"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

type View struct {
	onNewFormatClicked     func()
	onNewComparisonClicked func()
	onTabClicked           func()
	onCloseTabClicked      func()
	onSettingsClicked      func()
}

func NewView() *View {
	return &View{}
}

func (v *View) Render(c *ui.Context, state *State) {
	ui.Column(c.Key("sidebar")).Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {

		components.
			Sidebar(c.Key("sidebar-action")).
			Shrink(0).
			Children(func() { v.renderActions(c) })

		components.SidebarSection(c.Key("tabs-heading"), locales.CountTabs(len(state.tabs)), nil)

		components.
			ScrollView(c.Key("tabs-scroll"), components.ScrollViewOptions{}).
			Label(locales.TabList()).
			Grow(1).
			FillWidth().
			MinHeight(0).
			Children(func() { v.renderTabs(c, state) })
	})
}

func (v *View) renderActions(c *ui.Context) {
	t := c.Theme()
	ui.
		Column(c.Key("sidebar-actions")).
		FillWidth().
		Gap(t.Space(1)).
		Children(func() {
			newFormat := sidebarItem(c.Key("new-format"), locales.NewFormat(), lucide.Plus(), false)
			components.Tooltip(c, newFormat, locales.WithShortcut(locales.NewFormat(), "⌘N"))
			if newFormat.Clicked() && v.onNewFormatClicked != nil {
				v.onNewFormatClicked()
			}

			newComparison := sidebarItem(c.Key("new-comparison"), locales.NewComparison(), lucide.FileDiff(), false)
			if newComparison.Clicked() && v.onNewComparisonClicked != nil {
				v.onNewComparisonClicked()
			}

		})
}

func (v *View) renderTabs(c *ui.Context, state *State) {
	t := c.Theme()

	ui.Column(c.Key("tabs")).
		FillWidth().
		MinWidth(0).
		Padding(0, t.Space(3), t.Space(3), t.Space(3)).
		Gap(t.Space(1)).
		Children(func() {
			for _, tab := range state.tabs {

				row := ui.Row(c.Key("tab-row-" + strconv.Itoa(tab.Id))).FillWidth()
				row.Children(func() {
					item := sidebarItem(c.Key(tab.Id), tab.Title, nil, tab.Id == state.activeTab).
						Padding(t.Space(1.75), t.Space(9), t.Space(1.75), t.Space(2))

					if item.Clicked() && v.onTabClicked != nil {
						v.onTabClicked()
					}

					closeButton := sidebar.
						IconButton(c.Key("close-"+strconv.Itoa(tab.Id)), lucide.X(), locales.CloseTab(tab.Title)).
						Size(t.Space(6), t.Space(6)).
						Absolute().
						Right(t.Space(1)).
						Top(t.Space(1)).
						KeepFocus()

					if !row.Hovered() {
						closeButton.Invisible()
					}

					if closeButton.Clicked() && v.onCloseTabClicked != nil {
						v.onCloseTabClicked()
					}
				})

			}
		})
}

func (v *View) renderFooter(c *ui.Context) {
	footer := sidebar.IconButton(c.Key("settings"), lucide.Settings(), locales.WithShortcut(locales.Settings(), "⌘,")).
		Label(locales.Settings()).
		KeepFocus()
	if footer.Clicked() && v.onSettingsClicked != nil {
		v.onSettingsClicked()
	}
	ui.Spacer(c)
}

func sidebarItem(c *ui.Context, label string, icon *ui.SVG, selected bool) ui.Element {
	item := components.SidebarItem(c, label, icon, selected).KeepFocus()
	// 绑定悬停背景
	if !selected {
		t := c.Theme()
		item.Draw(func(p *ui.Painter, r ui.Rect) {
			if item.Hovered() && !item.IsDisabled() {
				p.Fill(r, t.Text.Alpha(.1), t.Radius)
			}
		})
	}
	return item
}
