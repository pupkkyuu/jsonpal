package editor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/locales"
)

// JSON owns one document, including undo, selection, scroll, search, focus,
// action results and asynchronous validation. It has no tab or window metadata.
type JSON struct {
	code          *mygoeditor.State
	focus         ui.Handle
	result        Result
	resultVersion uint64
	validation    jsonValidation
	wrapChord     *mygoeditor.Binding
}

var _ Editor = (*JSON)(nil)

func NewJSON(source string) *JSON {
	buffer := mygoeditor.NewBuffer(source)
	buffer.SetLanguage(mygoeditor.LanguageFor("document.json"))
	e := &JSON{
		code: &mygoeditor.State{
			Buffer: buffer, Theme: jsonEditorTheme(false), NoActiveLine: true, NoIndentGuides: true,
			Label: locales.EditorLabel(), Placeholder: locales.EditorPlaceholder(), TabSize: 2,
			RenderFindBar: FindBar,
			Bindings:      []mygoeditor.Binding{{Mods: ui.Cmd | ui.Shift, Key: ui.KeyF, Command: mygoeditor.NoCommand}},
		},
		result: Result{Message: locales.EditorInitialHint()}, resultVersion: buffer.Version(),
		validation: jsonValidation{results: make(chan jsonValidationResult, 1)},
	}
	e.code.Select(buffer.Len(), buffer.Len())
	return e
}

// State exposes the native single-document editing capabilities. It is specific
// to JSON; the workspace's Editor interface does not assume a single buffer.
func (e *JSON) State() *mygoeditor.State { return e.code }

// Focus requests keyboard focus for this document after its view has been built.
func (e *JSON) Focus() { e.focus.Focus() }

// CancelFocus removes a pending focus request when a multi-pane host chooses
// another document, including requests made while this view was not mounted.
func (e *JSON) CancelFocus() { e.focus.CancelFocus() }

func (e *JSON) Result() Result {
	e.refreshResult()
	return e.result
}

func (e *JSON) refreshResult() {
	if e.resultVersion != e.code.Buffer.Version() {
		e.result = Result{Message: locales.EditorModifiedHint()}
		e.resultVersion = e.code.Buffer.Version()
	}
}

func (e *JSON) View(c *ui.Context, options ViewOptions) {
	e.code.Theme = jsonEditorTheme(c.Theme().Dark)
	e.refreshResult()
	if options.Shortcuts && c.Shortcut(ui.Cmd|ui.Shift, ui.KeyF) {
		e.Format()
	}
	if wait := e.refreshJSONDiagnostics(c.Now(), c.Services().Invalidate); wait > 0 {
		c.After(wait)
	}
	e.diagnosticBackgrounds(c)
	view := mygoeditor.View(c.Key("json"), e.code).Fill().Bind(&e.focus)
	if !options.NoAutoFocus {
		view.AutoFocus()
	}
	if options.Focus {
		view.Focus()
	}
	wrapped := e.WrapEnabled()
	e.wrapShortcuts(view, options.Shortcuts)
	if wrapped != e.WrapEnabled() && options.OnWrapChanged != nil {
		options.OnWrapChanged(e.WrapEnabled())
		c.Invalidate()
	}
}
