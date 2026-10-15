package editor

import (
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/theme"
)

func awaitTransform(t *testing.T, tt *ui.Tester, e *JSON) {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for e.Busy() {
		if time.Now().After(deadline) {
			t.Fatal("background transformation did not finish")
		}
		tt.Frame()
		if e.Busy() {
			time.Sleep(time.Millisecond)
		}
	}
}

func newJSONTester(e *JSON, width, height int) *ui.Tester {
	tt := ui.NewTester(func(c *ui.Context) {
		theme.Apply(c)
		ui.Column(c).Fill().Children(func() {
			ui.Row(c).Height(48).Children(func() {
				if components.Button(c, "格式化 JSON", components.ButtonGhost).KeepFocus().Clicked() {
					e.Format()
				}
			})
			e.View(c, ViewOptions{Shortcuts: true})
		})
	}, width, height)
	tt.SetLocale("zh-Hans")
	return tt
}

func TestJSONEditorWorksWithoutWorkspace(t *testing.T) {
	e := NewJSON(`{"answer":42}`)
	tt := newJSONTester(e, 600, 400)
	tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
	awaitTransform(t, tt, e)
	if e.State().Buffer.String() != "{\n  \"answer\": 42\n}" {
		t.Fatal("standalone editor did not handle its formatting shortcut")
	}
	e.Compact()
	awaitTransform(t, tt, e)
	tt.Frame()
	if e.State().Buffer.String() != `{"answer":42}` || e.Result().HasError {
		t.Fatal("standalone editor did not compact its document")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if e.State().Buffer.String() != "{\n  \"answer\": 42\n}" {
		t.Fatal("standalone editor did not retain its undo history")
	}
}
