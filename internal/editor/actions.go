package editor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/jsondoc"
	"jsonpal/locales"
)

func (e *JSON) Format() {
	e.transformJSON(jsondoc.Format, locales.FormatSuccess())
}

func (e *JSON) Compact() {
	e.transformJSON(jsondoc.Compact, locales.CompactSuccess())
}

func (e *JSON) Escape() {
	e.transformText(jsondoc.Escape, locales.EscapeSuccess())
}

func (e *JSON) Unescape() {
	e.transformText(jsondoc.Unescape, locales.UnescapeSuccess())
}

func (e *JSON) SortFields() {
	e.transformJSON(jsondoc.SortFields, locales.SortSuccess())
}

func (e *JSON) Clear() {
	e.transform.Cancel()
	e.ApplyPreparedTransform(PreparedTransform{
		Version: e.code.Buffer.Version(), Changed: e.code.Buffer.Len() != 0,
	}, locales.WaitingForJSON())
}

// CopyAll copies the complete buffer without disturbing selections or scrolling.
// The host supplies its clipboard service so editors do not own platform access.
func (e *JSON) CopyAll(writeClipboard func(string)) {
	writeClipboard(e.code.Buffer.String())
	e.result = Result{Message: locales.CopySuccess()}
	e.resultVersion = e.code.Buffer.Version()
	e.focus.Focus()
}

func (e *JSON) transformJSON(transform func(string) (string, error), success string) {
	e.startTransform(transform, success, true)
}

func (e *JSON) transformText(transform func(string) (string, error), success string) {
	e.startTransform(transform, success, false)
}

func (e *JSON) startTransform(transform func(string) (string, error), success string, skipEmpty bool) {
	if e.transform.Start([]mygoeditor.Snapshot{e.code.Buffer.Snapshot()}, transform, skipEmpty) {
		e.transformMessage = success
		e.result = Result{Message: locales.Processing()}
		e.resultVersion = e.code.Buffer.Version()
	}
}

func (e *JSON) refreshTransform(c *ui.Context) {
	if results, ready := e.transform.Update(c); ready && len(results) != 0 {
		message := e.transformMessage
		if results[0].Empty {
			message = locales.WaitingForJSON()
		}
		e.ApplyPreparedTransform(results[0], message)
	}
}

func (e *JSON) Busy() bool { return e.transform.Busy() }

func (e *JSON) TransformEnabled() bool { return !e.Busy() }

// ApplyPreparedTransform commits matching worker output as one undoable edit.
// A multi-document host checks every version before committing either side.
// Call on the UI thread; stale output changes neither content nor view state.
func (e *JSON) ApplyPreparedTransform(result PreparedTransform, message string) bool {
	if result.Version != e.code.Buffer.Version() {
		return false
	}
	if result.HasError {
		message = ""
		if len(result.Diagnostics) != 0 {
			d := result.Diagnostics[0]
			message = locales.JsonErrorLocation(d.Line, d.Column, d.Detail)
		}
	} else if result.Changed {
		// Set creates one undoable edit, unlike Reset which discards history.
		e.code.Buffer.Set(result.Text)
	}
	e.result = Result{Message: message, HasError: result.HasError}
	e.setJSONDiagnostics(editorDiagnostics(result.Diagnostics))
	e.resetPosition()
	return true
}

func (e *JSON) resetPosition() {
	e.resultVersion = e.code.Buffer.Version()
	// Reset after the buffer update has been synchronized. Otherwise the native
	// editor maps the previous caret to the end and scrolls sideways to reveal it.
	e.code.Select(0, 0)
	e.code.ScrollTo(0)
	e.focus.Focus()
}
