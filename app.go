package main

import (
	"fmt"
	"strings"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/editor"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

const starterJSON = `{
  "Box": "It's bigger on the inside."
}`

type application struct {
	code          *editor.State
	editorFocus   ui.Handle
	status        string
	statusVersion uint64
	hasError      bool
	selectedTab   string
}

func newApplication() *application {
	buffer := editor.NewBuffer(starterJSON)
	buffer.SetLanguage(editor.LanguageFor("document.json"))
	app := &application{
		code: &editor.State{
			Buffer:         buffer,
			NoActiveLine:   true,
			NoIndentGuides: true,
			Label:          "JSON 编辑器",
			Placeholder:    "输入或粘贴 JSON",
			TabSize:        2,
			Bindings: []editor.Binding{
				{Mods: ui.Cmd | ui.Shift, Key: ui.KeyF, Command: editor.NoCommand},
			},
		},
		status:        "输入或粘贴 JSON，点击格式化或按 ⌘⇧F",
		statusVersion: buffer.Version(),
		selectedTab:   "format-1",
	}
	app.code.Select(buffer.Len(), buffer.Len())
	return app
}

func (app *application) shellOptions() sidebar.ShellOptions {
	return sidebar.ShellOptions{
		Title: "JSONPal",
		Width: 1000, Height: 650, MinWidth: 760, MinHeight: 400,
		LeftMinWidth: 180, LeftMaxWidth: 320,
		LeftToggleLabel: "侧边栏", LeftResizeLabel: "调整侧边栏宽度",
		Left: app.sidebar, LeftToolbar: app.sidebarFooter,
		ContentTitle: app.titlebar, Content: app.view,
	}
}

func (app *application) view(c *ui.Context) {
	// A previous result only describes the version that was formatted.
	if app.statusVersion != app.code.Buffer.Version() {
		app.status = "内容已修改，按 ⌘⇧F 格式化"
		app.hasError = false
		app.statusVersion = app.code.Buffer.Version()
	}
	if c.Shortcut(ui.Cmd|ui.Shift, ui.KeyF) {
		app.format()
	}

	// Shell installs the theme; the editable MyGo buffer inherits its palette.
	ui.Column(c.Key("editor-area")).Fill().Padding(sidebar.HeaderHeight(c), 0, 0, 0).Children(func() {
		editor.View(c.Key("editor"), app.code).Fill().Bind(&app.editorFocus).AutoFocus()
	})
}

func (app *application) format() {
	source := app.code.Buffer.String()
	app.hasError = false
	if strings.TrimSpace(source) == "" {
		app.status = "等待输入 JSON"
	} else if formatted, err := formatJSON(source); err != nil {
		app.status = fmt.Sprintf("JSON 格式错误：%s", err)
		app.hasError = true
	} else {
		if formatted != source {
			// Set creates one undoable edit, unlike Reset which discards history.
			app.code.Buffer.Set(formatted)
		}
		app.status = "JSON 有效，已格式化（2 空格缩进）"
	}
	app.statusVersion = app.code.Buffer.Version()
	app.editorFocus.Focus()
}
