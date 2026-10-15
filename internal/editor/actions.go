package editor

import (
	"fmt"
	"strings"

	"jsonpal/internal/jsondoc"
)

func (e *JSON) Format() {
	e.transformJSON(jsondoc.Format, "JSON 有效，已格式化（2 空格缩进）")
}

func (e *JSON) Compact() {
	e.transformJSON(jsondoc.Compact, "JSON 有效，已压缩")
}

func (e *JSON) Escape() {
	e.transformText(jsondoc.Escape, "已转义")
}

func (e *JSON) Unescape() {
	e.transformText(jsondoc.Unescape, "已去除一层转义")
}

func (e *JSON) SortFields() {
	e.transformJSON(jsondoc.SortFields, "JSON 有效，已按字段排序")
}

func (e *JSON) Clear() {
	e.ApplyText("", "等待输入 JSON")
}

// CopyAll copies the complete buffer without disturbing selections or scrolling.
// The host supplies its clipboard service so editors do not own platform access.
func (e *JSON) CopyAll(writeClipboard func(string)) {
	writeClipboard(e.code.Buffer.String())
	e.result = Result{Message: "已复制全部内容"}
	e.resultVersion = e.code.Buffer.Version()
	e.focus.Focus()
}

func (e *JSON) transformJSON(transform func(string) (string, error), success string) {
	if strings.TrimSpace(e.code.Buffer.String()) == "" {
		e.ApplyText(e.code.Buffer.String(), "等待输入 JSON")
		return
	}
	e.transformText(transform, success)
}

func (e *JSON) transformText(transform func(string) (string, error), success string) {
	source := e.code.Buffer.String()
	if result, err := transform(source); err != nil {
		e.ReportError(err)
	} else {
		e.ApplyText(result, success)
	}
}

// ApplyText commits prepared text as one undoable edit and refreshes diagnostics.
// Multi-document editors can calculate all results before committing either side.
func (e *JSON) ApplyText(result, message string) {
	if result != e.code.Buffer.String() {
		// Set creates one undoable edit, unlike Reset which discards history.
		e.code.Buffer.Set(result)
	}
	e.result = Result{Message: message}
	// Unescaped strings may be ordinary text; diagnose the resulting document
	// rather than assuming every successful transformation produces valid JSON.
	e.setJSONDiagnostics(editorDiagnostics(jsondoc.Validate(result)))
	e.resetPosition()
}

// ReportError diagnoses a failed operation against the unchanged document.
func (e *JSON) ReportError(err error) {
	e.result = Result{Message: fmt.Sprintf("JSON 格式错误：%s", err), HasError: true}
	e.setJSONDiagnostics(editorDiagnostics(jsondoc.DiagnosticsForError(e.code.Buffer.String(), err)))
	e.resetPosition()
}

func (e *JSON) resetPosition() {
	e.resultVersion = e.code.Buffer.Version()
	// Reset after the buffer update has been synchronized. Otherwise the native
	// editor maps the previous caret to the end and scrolls sideways to reveal it.
	e.code.Select(0, 0)
	e.code.ScrollTo(0)
	e.focus.Focus()
}
