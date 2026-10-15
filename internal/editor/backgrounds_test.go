package editor

import (
	"image"
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"

	"jsonpal/internal/jsondoc"
)

func TestErrorBackgroundTracksDiagnosticsAndAppearance(t *testing.T) {
	for _, source := range []string{`{"中文😀":]}`, "{\n  \"中文😀\": ]\n}", "{\n  \"value\": 1\n", "{\n  \"value\": \"" + strings.Repeat("a", 200) + "\n}"} {
		t.Run(source, func(t *testing.T) {
			e := NewJSON(source)
			e.State().SoftWrap = true
			tt := newJSONTester(e, 600, 400)
			before := cloneImage(tt.Image())
			e.Format()
			awaitTransform(t, tt, e)
			tt.Frame()
			ds := e.State().Diagnostics()
			backgrounds := e.State().LineBackgrounds
			if len(ds) != 1 || len(backgrounds) != 1 {
				t.Fatalf("missing diagnostic or line background: %v, %v", ds, backgrounds)
			}
			line := e.State().Buffer.Pos(ds[0].Start).Line
			if backgrounds[0].First != line || backgrounds[0].Last != line {
				t.Fatal("background does not follow the diagnostic's UTF-8 byte offset")
			}
			// Far from text and carets, a broad changed region proves the line
			// fill was rendered, rather than only the diagnostic underline.
			changed := 0
			after := tt.Image()
			for y := 60; y < 220; y++ {
				for x := 450; x < 550; x++ {
					if before.RGBAAt(x, y) != after.RGBAAt(x, y) {
						changed++
					}
				}
			}
			if changed < 500 {
				t.Fatalf("error line fill did not render: %d changed pixels", changed)
			}
			light := backgrounds[0].Color
			version, selection := e.State().Buffer.Version(), e.State().Selection()
			tt.SetDark(true)
			dark := e.State().LineBackgrounds[0].Color
			tt.SetPreferences(ui.Preferences{HighContrast: true})
			if dark == light || e.State().LineBackgrounds[0].Color.A <= dark.A {
				t.Fatal("error background did not follow dark or high-contrast appearance")
			}
			if e.State().Buffer.Version() != version || e.State().Selection() != selection {
				t.Fatal("decoration altered document or selection")
			}
			tt.Key(ui.Cmd, ui.KeyA)
			tt.Type(`{}`)
			if len(e.State().Diagnostics()) != 0 || len(e.State().LineBackgrounds) != 0 {
				t.Fatal("editing did not clear the old error fill")
			}
			tt.Key(ui.Cmd, ui.KeyZ)
			if e.State().Buffer.String() != source {
				t.Fatal("line backgrounds interfered with undo")
			}
			done := make(chan struct{}, 1)
			due := e.validation.deadline
			e.refreshJSONDiagnostics(due, func() { done <- struct{}{} })
			awaitJSONValidation(t, done)
			e.refreshJSONDiagnostics(due, func() { done <- struct{}{} })
			tt.Frame()
			if len(e.State().LineBackgrounds) != 1 {
				t.Fatal("undo did not restore the error fill after validation")
			}
		})
	}
}

func TestStaleValidationCannotRestoreErrorBackground(t *testing.T) {
	e := NewJSON(`{"a":]}`)
	tt := newJSONTester(e, 600, 400)
	e.Format()
	awaitTransform(t, tt, e)
	tt.Frame()
	oldVersion := e.State().Buffer.Version()
	e.State().Buffer.Set(`{}`)
	e.validation.results <- jsonValidationResult{version: oldVersion, diagnostics: jsondoc.Validate(`{"a":]}`)}
	e.refreshJSONDiagnostics(time.Now(), func() {})
	tt.Frame()
	if len(e.State().LineBackgrounds) != 0 || len(e.State().Diagnostics()) != 0 {
		t.Fatal("stale validation restored a decoration on the new document")
	}
}

func cloneImage(src *image.RGBA) *image.RGBA {
	out := image.NewRGBA(src.Bounds())
	copy(out.Pix, src.Pix)
	return out
}
