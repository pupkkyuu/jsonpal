package desktop

import (
	"jsonpal/internal/welcome"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	onevraSidebar "github.com/oneo-me/onevra/source/shells/sidebar"
	"github.com/oneo-me/onevra/source/theme"

	"jsonpal/internal/editor"
	"jsonpal/internal/settings"
	"jsonpal/internal/sidebar"
	"jsonpal/locales"
)

type application struct {
	shell                *onevraSidebar.Shell
	tabs                 []*workspaceTab
	activeTab            *workspaceTab
	nextTabNumber        int
	nextComparisonNumber int
	focusEditor          bool
	revealTab            string

	// 分割线
	settings      *settings.Settings
	isSettingOpen bool

	sidebar *sidebar.Sidebar
}

func Run() error {
	app := &application{
		settings: settings.NewSetting(),
		sidebar:  sidebar.NewSidebar(),
	}

	app.settings.OnClose = func() {
		app.isSettingOpen = false
	}

	app.sidebar.OnSettingsClicked = func() {
		app.isSettingOpen = true
	}

	app.sidebar.OnNewFormatClicked = func() {
		// 渲染左侧的标签
		// 右侧编辑器暂时没有
	}

	// todo test only
	tabs := []sidebar.Tab{{0, "格式112233"}}
	app.sidebar.SetTabs(tabs, 0)

	mygo.App.WhenReady(func() { app.shell = onevraSidebar.NewShell(app.shellOptions()) })
	return mygo.App.Run()
}

func (app *application) shellOptions() onevraSidebar.ShellOptions {
	return onevraSidebar.ShellOptions{
		Title:           "JSONPal",
		Theme:           theme.Onevra,
		Width:           1000,
		Height:          650,
		MinWidth:        760,
		MinHeight:       400,
		LeftWidth:       200,
		LeftMinWidth:    180,
		LeftMaxWidth:    320,
		LeftToggleLabel: locales.WithShortcut(locales.SidebarToggle(), "⌘B"),
		Left:            app.sidebar.View,
		LeftToolbar:     app.sidebar.FooterView,
		ContentTitle:    app.titlebar,
		Content:         app.view,
	}
}

func (app *application) view(c *ui.Context) {
	if c.Shortcut(ui.Cmd, ui.KeyComma) {
		app.isSettingOpen = true
	}
	if !app.isSettingOpen {
		if c.Shortcut(ui.Cmd, ui.KeyB) && app.shell != nil {
			app.shell.SetLeftExpanded(!app.shell.LeftExpanded())
			c.Invalidate()
		}
		if c.Shortcut(ui.Cmd, ui.KeyN) {
			app.addFormatTab("")
		}
		if c.Shortcut(ui.Ctrl, ui.KeyTab) {
			app.cycleTab(1)
			c.Invalidate()
		}
		if c.Shortcut(ui.Ctrl|ui.Shift, ui.KeyTab) {
			app.cycleTab(-1)
			c.Invalidate()
		}
	}
	tab := app.activeTab

	if tab == nil {
		welcome.View(c)
	} else {
		// The host provides layout and a stable identity; the editor owns its view.
		ui.
			Column(c.Key("editor-area")).
			Fill().
			Padding(onevraSidebar.HeaderHeight(c), 0, 0, 0).
			Children(func() {
				tab.editor.View(c.Key(tab.id), editor.ViewOptions{
					Focus:     app.focusEditor,
					Shortcuts: !app.isSettingOpen,
				})
				app.focusEditor = false
			})
	}

	app.settings.View(c, app.isSettingOpen)
}
