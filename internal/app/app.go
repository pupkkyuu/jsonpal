package desktop

import (
	"jsonpal/internal/editor"
	"jsonpal/internal/welcome"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	onevraSidebar "github.com/oneo-me/onevra/source/shells/sidebar"
	"github.com/oneo-me/onevra/source/theme"

	"jsonpal/internal/settings"
	"jsonpal/internal/sidebar"
	"jsonpal/locales"
)

type Application struct {
	shell *onevraSidebar.Shell

	nextComparisonNumber int
	revealTab            string
	focusEditor          bool

	// 分割线
	settingState settings.State

	editors []editor.Editor
	active  editor.Editor

	next int
}

func Run() error {
	app := &Application{
		settingState: settings.State{},
	}

	shell := onevraSidebar.ShellOptions{
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
		Left:            app.sidebar,
		LeftToolbar:     app.sidebarFooter,
		ContentTitle:    app.titlebar, // todo 暂时略
		Content:         app.view,     // todo 渲染编辑器
	}

	mygo.App.WhenReady(func() { app.shell = onevraSidebar.NewShell(shell) })
	return mygo.App.Run()
}

func (app *Application) view(c *ui.Context) {
	if c.Shortcut(ui.Cmd, ui.KeyComma) {
		app.settingState.Open = true
	}
	if !app.settingState.Open {
		if c.Shortcut(ui.Cmd, ui.KeyB) && app.shell != nil {
			app.shell.SetLeftExpanded(!app.shell.LeftExpanded())
			c.Invalidate()
		}
		if c.Shortcut(ui.Cmd, ui.KeyN) {
			app.addFormatEditor()
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

	if app.active == nil {
		welcome.View(c)
	} else {
		// The host provides layout and a stable identity; the editor owns its view.
		ui.
			Column(c.Key("editor-area")).
			Fill().
			Padding(onevraSidebar.HeaderHeight(c), 0, 0, 0).
			Children(func() {
				app.active.View(c)
			})
	}

	settings.View(c, &app.settingState)

}

func (app *Application) sidebar(c *ui.Context) {
	tabs := make([]sidebar.Tab, 0, len(app.editors))
	for _, e := range app.editors {
		tabs = append(tabs, sidebar.Tab{
			Id:    e.Id(),
			Title: e.Title(),
		})
	}

	var active sidebar.Tab
	if app.active != nil {
		active = sidebar.Tab{
			Id:    app.active.Id(),
			Title: app.active.Title(),
		}
	}

	events := sidebar.View(c, sidebar.Options{
		Active: active,
		Tabs:   tabs,
	})

	if events.OnNewFormatClicked {
		app.addFormatEditor()
	}

}

func (app *Application) sidebarFooter(c *ui.Context) {
	events := sidebar.FooterView(c)
	if events.OnSettingsClicked {
		app.settingState.Open = true
	}
}

func (app *Application) addFormatEditor() {
	app.next++
	e := editor.NewFormatEditor(app.next, "")
	app.active = e
	app.editors = append(app.editors, e)
	e.Focus()
}
