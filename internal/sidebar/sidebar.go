package sidebar

import (
	"jsonpal/locales"
	"strconv"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

type Options struct {
	Active Tab
	Tabs   []Tab
}

type Events struct {
	OnNewFormatClicked     bool
	OnNewComparisonClicked bool

	OnTabClicked      bool
	OnTabCloseClicked bool
	ClickedTabId      int
}

func View(c *ui.Context, options Options) Events {
	events := Events{}
	ui.Column(c.Key("sidebar")).Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {

		components.
			Sidebar(c.Key("sidebar-action")).
			Shrink(0).
			Children(func() { renderActions(c, &events) })

		components.SidebarSection(c.Key("tabs-heading"), locales.CountTabs(len(options.Tabs)), nil)

		components.
			ScrollView(c.Key("tabs-scroll"), components.ScrollViewOptions{}).
			Label(locales.TabList()).
			Grow(1).
			FillWidth().
			MinHeight(0).
			Children(func() { renderTabs(c, options, &events) })
	})

	return events
}

func renderActions(c *ui.Context, result *Events) {
	t := c.Theme()
	ui.
		Column(c.Key("sidebar-actions")).
		FillWidth().
		Gap(t.Space(1)).
		Children(func() {
			newFormat := sidebarItem(c.Key("new-format"), locales.NewFormat(), lucide.Plus(), false)
			components.Tooltip(c, newFormat, locales.WithShortcut(locales.NewFormat(), "⌘N"))

			if newFormat.Clicked() {
				result.OnNewFormatClicked = true
			}

			newComparison := sidebarItem(c.Key("new-comparison"), locales.NewComparison(), lucide.FileDiff(), false)

			if newComparison.Clicked() {
				result.OnNewComparisonClicked = true
			}

		})
}

func renderTabs(c *ui.Context, options Options, events *Events) {
	t := c.Theme()

	ui.Column(c.Key("tabs")).
		FillWidth().
		MinWidth(0).
		Padding(0, t.Space(3), t.Space(3), t.Space(3)).
		Gap(t.Space(1)).
		Children(func() {
			for _, tab := range options.Tabs {

				row := ui.Row(c.Key("tab-row-" + strconv.Itoa(tab.Id))).FillWidth()
				row.Children(func() {
					item := sidebarItem(c.Key(tab.Id), tab.Title, nil, tab.Id == options.Active.Id).
						Padding(t.Space(1.75), t.Space(9), t.Space(1.75), t.Space(2))

					if item.Clicked() {
						events.OnTabClicked = true
						events.ClickedTabId = tab.Id
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

					if closeButton.Clicked() {
						events.OnTabClicked = true
						events.ClickedTabId = tab.Id
					}
				})

			}
		})
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

type FooterEvents struct {
	OnSettingsClicked bool
}

func FooterView(c *ui.Context) FooterEvents {
	events := FooterEvents{}
	footer := sidebar.IconButton(c.Key("settings"), lucide.Settings(), locales.WithShortcut(locales.Settings(), "⌘,")).
		Label(locales.Settings()).
		KeepFocus()
	if footer.Clicked() {
		events.OnSettingsClicked = true
	}
	ui.Spacer(c)

	return events
}
