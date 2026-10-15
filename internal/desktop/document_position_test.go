package desktop

import (
	"bytes"
	"image"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/editor"
	"jsonpal/internal/jsondoc"
)

func TestDocumentActionsReturnCaretAndViewportToDocumentStart(t *testing.T) {
	longValue := `"begin ` + strings.Repeat("long JSON value ", 200) + ` end"`
	multiline := "[\n" + strings.Repeat("  "+longValue+",\n", 60) + "  " + longValue + "\n]"
	for _, test := range []struct {
		name, source            string
		shortcut, wrap, compact bool
	}{
		{name: "long line", source: `{"value":` + longValue + `}`},
		{name: "unchanged long string", source: longValue},
		{name: "scrolled multiline", source: multiline},
		{name: "shortcut", source: multiline, shortcut: true},
		{name: "wrapped", source: multiline, wrap: true},
		{name: "compact long line", source: `{"value":` + longValue + `}`, compact: true},
		{name: "compact unchanged long string", source: longValue, compact: true},
		{name: "compact scrolled multiline", source: multiline, compact: true},
		{name: "compact wrapped", source: multiline, wrap: true, compact: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			transform, label := jsondoc.Format, "格式化 JSON"
			if test.compact {
				transform, label = jsondoc.Compact, "压缩"
			}
			transformed, err := transform(test.source)
			if err != nil {
				t.Fatal(err)
			}
			app := newEditingApplication()
			tab := app.addFormatTab(test.source)
			state := editorState(tab)
			state.SoftWrap = test.wrap
			tt := newApplicationTester(app, 1000, 650)
			state.Select(state.Buffer.Len(), state.Buffer.Len())
			tt.Frame()
			r, ok := tt.Find("JSON 编辑器")
			if !ok {
				t.Fatal("missing editor")
			}
			tt.Scroll(r.X+r.W/2, r.Y+r.H/2, 50000, 50000)
			if test.shortcut {
				tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
			} else if err := tt.Click(label); err != nil {
				t.Fatal(err)
			}
			awaitTransform(t, tt, app)
			if state.Selection() != (editor.Selection{}) || state.Buffer.String() != transformed || !tt.Focused("JSON 编辑器") {
				t.Fatalf("%s did not return the caret to the start: %v", label, state.Selection())
			}

			// Compare the visible text against a fresh editor at the origin. This
			// checks both scroll axes without accessing native private scroll state.
			reference := newEditingApplication()
			refTab := reference.addFormatTab(transformed)
			refState := editorState(refTab)
			refState.SoftWrap = test.wrap
			refState.Select(0, 0)
			refTester := newApplicationTester(reference, 1000, 650)
			crop := image.Rect(int(r.X)+80, int(r.Y)+5, int(r.X)+400, int(r.Y)+85)
			if !bytes.Equal(copyPixels(tt.Image(), crop), copyPixels(refTester.Image(), crop)) {
				t.Fatal("transformed viewport did not return to the top left")
			}
			// A later frame must not remap the caret back to the previous end.
			tt.Frame()
			if state.Cursor() != 0 {
				t.Fatal("a later frame moved the caret away from the document start")
			}
			if transformed != test.source {
				tt.Key(ui.Cmd, ui.KeyZ)
				if state.Buffer.String() != test.source {
					t.Fatal("resetting the caret interfered with document undo")
				}
			}
		})
	}
}

func TestFormatReturnsToStartOnEmptyOrInvalidInput(t *testing.T) {
	for _, source := range []string{" \n \t", `{"value":` + strings.Repeat(" ", 500) + `]}`} {
		app := newEditingApplication()
		tab := app.addFormatTab(source)
		state := editorState(tab)
		tt := newApplicationTester(app, 1000, 650)
		if err := tt.Click("格式化 JSON"); err != nil {
			t.Fatal(err)
		}
		awaitTransform(t, tt, app)
		if state.Selection() != (editor.Selection{}) || state.Buffer.String() != source || state.Buffer.CanUndo() {
			t.Fatal("format should return to the start without editing invalid or empty input")
		}
	}
}
