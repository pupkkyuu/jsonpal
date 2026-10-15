package desktop

import (
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/shells/sidebar"
	"github.com/oneo-me/onevra/source/theme"

	"jsonpal/internal/editor"
	"jsonpal/internal/setting"
	"jsonpal/locales"
)

type application struct {
	shell                *sidebar.Shell
	tabs                 []*workspaceTab
	activeTab            *workspaceTab
	nextTabNumber        int
	nextComparisonNumber int
	focusEditor          bool
	revealTab            string
	settings             *setting.Panel
}

func newApplication() *application {
	app := &application{
		// The default Shell palette and editor theme follow the native appearance.
		settings: setting.NewPanel(mygo.Theme.Source(), mygo.Theme.SetSource),
	}
	return app
}

func (app *application) shellOptions() sidebar.ShellOptions {
	return sidebar.ShellOptions{
		Title: "JSONPal", Theme: theme.Onevra,
		Width: 1000, Height: 650, MinWidth: 760, MinHeight: 400,
		LeftWidth: 200, LeftMinWidth: 180, LeftMaxWidth: 320,
		LeftToggleLabel: locales.WithShortcut(locales.SidebarToggle(), "⌘B"),
		Left:            app.sidebar, LeftToolbar: app.sidebarFooter,
		ContentTitle: app.titlebar, Content: app.view,
	}
}

func (app *application) view(c *ui.Context) {
	if c.Shortcut(ui.Cmd, ui.KeyComma) {
		app.settings.Open()
	}
	if !app.settings.IsOpen() {
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
		app.welcome(c)
	} else {
		// The host provides layout and a stable identity; the editor owns its view.
		ui.Column(c.Key("editor-area")).Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {
			tab.editor.View(c.Key(tab.id), editor.ViewOptions{Focus: app.focusEditor, Shortcuts: !app.settings.IsOpen()})
			app.focusEditor = false
		})
	}
	app.settings.View(c)
}
