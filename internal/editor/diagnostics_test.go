package editor

import (
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
)

func awaitJSONValidation(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("background JSON validation did not finish")
	}
}

func TestJSONValidationDebounceAndStaleResults(t *testing.T) {
	e := NewJSON("")
	now := time.Unix(1, 0)
	done := make(chan struct{}, 1)
	wake := func() { done <- struct{}{} }
	e.code.Buffer.Set(`{"a":]}`)
	if wait := e.refreshJSONDiagnostics(now, wake); wait != jsonValidationDelay {
		t.Fatalf("initial debounce = %v", wait)
	}
	e.refreshJSONDiagnostics(now.Add(200*time.Millisecond), wake)
	if e.validation.running {
		t.Fatal("validation started before the debounce elapsed")
	}
	e.code.Buffer.Set(`{"b":}`)
	changedAt := now.Add(250 * time.Millisecond)
	if wait := e.refreshJSONDiagnostics(changedAt, wake); wait != jsonValidationDelay {
		t.Fatal("typing did not reset the debounce")
	}
	e.refreshJSONDiagnostics(now.Add(jsonValidationDelay), wake)
	if e.validation.running {
		t.Fatal("validation used the old input deadline")
	}
	due := changedAt.Add(jsonValidationDelay)
	e.refreshJSONDiagnostics(due, wake)
	awaitJSONValidation(t, done)

	// A completed result is still stale if the user edits before it is applied.
	e.code.Buffer.Set(`{"fixed":true}`)
	e.refreshJSONDiagnostics(due.Add(time.Millisecond), wake)
	if len(e.code.Diagnostics()) != 0 {
		t.Fatal("stale worker result marked the new document")
	}
	nextDue := due.Add(time.Millisecond + jsonValidationDelay)
	e.refreshJSONDiagnostics(nextDue, wake)
	awaitJSONValidation(t, done)
	e.refreshJSONDiagnostics(nextDue, wake)
	if e.validation.pending || len(e.code.Diagnostics()) != 0 {
		t.Fatal("valid input did not complete validation")
	}

	e.code.Buffer.Set(`{"a":]}`)
	e.refreshJSONDiagnostics(nextDue, wake)
	e.refreshJSONDiagnostics(nextDue.Add(jsonValidationDelay), wake)
	awaitJSONValidation(t, done)
	e.refreshJSONDiagnostics(nextDue.Add(jsonValidationDelay), wake)
	if len(e.code.Diagnostics()) != 1 {
		t.Fatal("invalid input was not marked after the debounce")
	}
	e.code.Buffer.Set(`{}`)
	e.refreshJSONDiagnostics(nextDue.Add(jsonValidationDelay+time.Millisecond), wake)
	if len(e.code.Diagnostics()) != 0 {
		t.Fatal("typing did not immediately clear old diagnostics")
	}
}

func TestFormatDiagnosticsAndUndo(t *testing.T) {
	e := NewJSON("")
	tt := newJSONTester(e, 600, 400)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"a":]}`)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if len(e.code.Diagnostics()) != 1 || e.validation.pending {
		t.Fatal("explicit format did not diagnose immediately")
	}
	redPixels := 0
	img := tt.Image()
	for y := 50; y < 85; y++ {
		for x := 0; x < 200; x++ {
			p := img.RGBAAt(x, y)
			if p.R > 170 && p.G < 65 && p.B > 20 && p.B < 90 {
				redPixels++
			}
		}
	}
	if redPixels == 0 {
		t.Fatal("JSON diagnostic did not draw an error underline")
	}
	e.code.Buffer.Transact(func() {
		tt.Key(ui.Cmd, ui.KeyA)
		tt.Type(`[]`)
	})
	if len(e.code.Diagnostics()) != 0 {
		t.Fatal("correcting input left an old error marker")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if e.code.Buffer.String() != `{"a":]}` {
		t.Fatal("diagnostics interfered with undo")
	}
	done := make(chan struct{}, 1)
	due := e.validation.deadline
	e.refreshJSONDiagnostics(due, func() { done <- struct{}{} })
	awaitJSONValidation(t, done)
	e.refreshJSONDiagnostics(due, func() { done <- struct{}{} })
	if len(e.code.Diagnostics()) != 1 {
		t.Fatal("undo did not restore JSON validation")
	}
}
