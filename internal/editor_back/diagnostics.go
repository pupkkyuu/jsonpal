package editor

import (
	"time"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/json"
	"jsonpal/locales"
)

const jsonValidationDelay = 300 * time.Millisecond

// Only the UI thread changes this state. A single worker sends immutable
// results back through the channel and asks the window for a new frame.
type jsonValidation struct {
	version     uint64
	initialized bool
	pending     bool
	deadline    time.Time
	running     bool
	results     chan jsonValidationResult
}

type jsonValidationResult struct {
	version     uint64
	diagnostics []json.Diagnostic
}

func (e *JSON) refreshJSONDiagnostics(now time.Time, wake func()) time.Duration {
	v := &e.validation
	version := e.code.Buffer.Version()
	if !v.initialized || v.version != version {
		v.version, v.initialized, v.pending = version, true, true
		v.deadline = now.Add(jsonValidationDelay)
		// Old diagnostics describe an earlier document; remove them on input.
		e.code.SetDiagnostics(version, nil)
		e.code.LineBackgrounds = nil
	}
	select {
	case result := <-v.results:
		v.running = false
		if result.version == version && v.pending {
			e.setJSONDiagnostics(editorDiagnostics(result.diagnostics))
		}
	default:
	}
	if !v.pending {
		return 0
	}
	if remaining := v.deadline.Sub(now); remaining > 0 {
		return remaining
	}
	if !v.running {
		v.running = true
		snapshot, results := e.code.Buffer.Snapshot(), v.results
		go func() {
			results <- jsonValidationResult{
				version: snapshot.Version(), diagnostics: json.Validate(snapshot.String()),
			}
			wake()
		}()
	}
	return 0
}

func (e *JSON) setJSONDiagnostics(diagnostics []mygoeditor.Diagnostic) {
	version := e.code.Buffer.Version()
	e.code.SetDiagnostics(version, diagnostics)
	// Line backgrounds are fixed line numbers, so never retain them from a
	// different diagnostic set. The next view supplies the frame's color.
	e.code.LineBackgrounds = nil
	e.validation.version, e.validation.initialized, e.validation.pending = version, true, false
}

// Translate document diagnostics at the UI boundary; json stays UI-independent.
func editorDiagnostics(diagnostics []json.Diagnostic) []mygoeditor.Diagnostic {
	if len(diagnostics) == 0 {
		return nil
	}
	result := make([]mygoeditor.Diagnostic, len(diagnostics))
	for i, d := range diagnostics {
		result[i] = mygoeditor.Diagnostic{Start: d.Start, End: d.End, Message: locales.JsonErrorLocation(d.Line, d.Column, d.Detail), Severity: mygoeditor.SeverityError, Source: "JSON"}
	}
	return result
}

func (e *JSON) diagnosticBackgrounds(c *ui.Context) {
	e.code.LineBackgrounds = e.code.LineBackgrounds[:0]
	alpha := float32(.10)
	if c.Preferences().HighContrast {
		alpha = .16
	}
	for _, d := range e.code.Diagnostics() {
		if d.Severity != mygoeditor.SeverityError {
			continue
		}
		line := e.code.Buffer.Pos(d.Start).Line
		e.code.LineBackgrounds = append(e.code.LineBackgrounds, mygoeditor.LineBackground{
			First: line, Last: line, Color: c.Theme().Danger.Alpha(alpha),
		})
	}
}
