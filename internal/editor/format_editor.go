package editor

import (
	"jsonpal/locales"
	"strconv"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/json"
)

type FormatEditor struct {
	id    int
	title string
	focus ui.Handle
	mygoeditor.State
}

func (e *FormatEditor) Id() int {
	return e.id
}

func (e *FormatEditor) Title() string {
	return e.title
}

func NewFormatEditor(id int, content string) *FormatEditor {
	buffer := mygoeditor.NewBuffer(content)
	buffer.SetLanguage(mygoeditor.LanguageFor("document.json"))
	return &FormatEditor{
		id:           id,
		title:        "格式化 " + strconv.Itoa(id),
		Buffer:       buffer,
		Label:        locales.EditorLabel(),
		Placeholder:  locales.EditorPlaceholder(),
		NoActiveLine: true,
		Bindings:     []mygoeditor.Binding{{Mods: ui.Cmd | ui.Shift, Key: ui.KeyF, Command: mygoeditor.NoCommand}},
	}
}

func (e *FormatEditor) View(c *ui.Context) {
	e.State.Theme = Theme(c.Theme().Dark)
	if c.Shortcut(ui.Cmd|ui.Shift, ui.KeyF) {
		e.Format()
	}
	mygoeditor.View(c.Key("json"), &e.State).Fill().Bind(&e.focus)
}

func (e *FormatEditor) Format() {
	str, _ := json.Format(e.Buffer.String())
	e.Buffer.Set(str)
	e.State.Select(0, 0)
	e.ScrollTo(0)
}

func (e *FormatEditor) Focus() {
	e.focus.Focus()
}
