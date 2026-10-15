package desktop

import (
	"bytes"
	"image"
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
)

func TestTextToolButtonsAndUndo(t *testing.T) {
	for _, test := range []struct {
		name, button, source, want string
		diagnostics                int
	}{
		{"escape ordinary text", "转义", "中文\n\"hello\"", `"中文\n\"hello\""`, 0},
		{"escape empty", "转义", "", `""`, 0},
		{"unescape unquoted input", "去转义", `{\"b\":1}`, `{"b":1}`, 0},
		{"unescape ordinary text", "去转义", `"hello\nworld"`, "hello\nworld", 1},
		{"sort recursively", "字段排序", `{"z":[{"b":900719925474099312345,"a":1.2300}],"a":null}`, "{\n  \"a\": null,\n  \"z\": [\n    {\n      \"a\": 1.2300,\n      \"b\": 900719925474099312345\n    }\n  ]\n}", 0},
		{"clear invalid input", "清空", `{"a":]}`, "", 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			app := newEditingApplication()
			inactive := app.activeTab
			tab := app.addFormatTab(test.source)
			state := editorState(tab)
			tt := newApplicationTester(app, 1000, 650)
			if err := tt.Click(test.button); err != nil {
				t.Fatal(err)
			}
			if state.Buffer.String() != test.want || tab.editor.Result().HasError || len(state.Diagnostics()) != test.diagnostics {
				t.Fatalf("%s = %q, %v; want %q with %d diagnostics", test.button, state.Buffer.String(), tab.editor.Result(), test.want, test.diagnostics)
			}
			if state.Selection() != (mygoeditor.Selection{}) || !tt.Focused("JSON 编辑器") {
				t.Fatal("text action did not return focus and position to the document start")
			}
			tt.Key(ui.Cmd, ui.KeyZ)
			if state.Buffer.String() != test.source {
				t.Fatal("one undo did not restore the original document")
			}
			tt.Key(ui.Cmd|ui.Shift, ui.KeyZ)
			if state.Buffer.String() != test.want || editorState(inactive).Buffer.String() != starterJSON || editorState(inactive).Buffer.CanUndo() {
				t.Fatal("redo or inactive editor isolation failed")
			}
		})
	}
}

func TestFailedAndUnchangedTextActions(t *testing.T) {
	for _, test := range []struct {
		button, source string
		error          bool
	}{
		{"字段排序", `{"a":]}`, true},
		{"去转义", `bad\q`, true},
		{"去转义", `{"already":"JSON"}`, false},
		{"清空", "", false},
		{"字段排序", " \n ", false},
	} {
		app := newEditingApplication()
		tab := app.addFormatTab(test.source)
		state := editorState(tab)
		version := state.Buffer.Version()
		tt := newApplicationTester(app, 1000, 650)
		if err := tt.Click(test.button); err != nil {
			t.Fatal(err)
		}
		if state.Buffer.String() != test.source || state.Buffer.Version() != version || state.Buffer.CanUndo() || tab.editor.Result().HasError != test.error {
			t.Fatalf("%s failed to protect input %q", test.button, test.source)
		}
		if test.error && len(state.Diagnostics()) != 1 {
			t.Fatal("failed action did not show an immediate diagnostic")
		}
	}
}

func TestCopyAllPreservesSelectionAndDocument(t *testing.T) {
	app := newEditingApplication()
	const source = "{\n  \"text\": \"中文 😀\"\n}"
	tab := app.addFormatTab(source)
	state := editorState(tab)
	tt := newWorkspaceTester(app, 1000, 650)
	state.Select(5, 12)
	tt.Frame()
	selection, version := state.Selection(), state.Buffer.Version()
	if err := tt.Click("复制"); err != nil {
		t.Fatal(err)
	}
	if tt.Clipboard() != source || state.Selection() != selection || state.Buffer.Version() != version || state.Buffer.CanUndo() {
		t.Fatal("copy all did not copy the full text or changed editing state")
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("copy all did not preserve editor focus")
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.KeyV)
	if editorState(app.activeTab).Buffer.String() != source || state.Selection() != selection {
		t.Fatal("copied clipboard text could not be pasted into another editor")
	}
}

func TestWrapToggleUsesNativeStateAndPersistsAcrossTabs(t *testing.T) {
	app := newEditingApplication()
	first := app.activeTab
	state := editorState(first)
	source := `"` + strings.Repeat("中文 long text ", 120) + `"`
	state.Buffer.Set(source)
	state.Select(0, 0)
	tt := newWorkspaceTester(app, 1000, 650)
	r, _ := tt.Find("JSON 编辑器")
	crop := image.Rect(int(r.X)+80, int(r.Y)+5, int(r.X)+400, int(r.Y)+180)
	unwrapped := copyPixels(tt.Image(), crop)
	selection, version := state.Selection(), state.Buffer.Version()
	if err := tt.Click("自动换行"); err != nil {
		t.Fatal(err)
	}
	wrapped := copyPixels(tt.Image(), crop)
	if bytes.Equal(unwrapped, wrapped) {
		t.Fatal("wrap toggle did not change the visible long-line layout")
	}
	if state.Selection() != selection || state.Buffer.Version() != version || !tt.Focused("JSON 编辑器") {
		t.Fatal("wrap toggle changed document selection, text or focus")
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	second := app.activeTab
	editorState(second).Buffer.Set(source)
	editorState(second).Select(0, 0)
	tt.Frame()
	if !bytes.Equal(unwrapped, copyPixels(tt.Image(), crop)) {
		t.Fatal("another editor inherited the first editor's wrap toggle")
	}
	if err := tt.Click(first.title); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(wrapped, copyPixels(tt.Image(), crop)) {
		t.Fatal("switching editors lost the wrap toggle")
	}
	// Cmd+K, Z is MyGo's native macOS wrap chord. The toolbar uses that same
	// internal state, so this returns to the initial unwrapped layout.
	tt.Key(ui.Cmd, ui.KeyK)
	tt.Key(0, ui.KeyZ)
	if !bytes.Equal(unwrapped, copyPixels(tt.Image(), crop)) {
		t.Fatal("toolbar and native wrap shortcut did not share view state")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if state.Buffer.String() != starterJSON {
		t.Fatal("wrap toggles added a document undo step")
	}
}

func TestSearchButtonOpensNativeFindBar(t *testing.T) {
	app := newEditingApplication()
	tab := app.addFormatTab(`["alpha","beta","alpha"]`)
	state := editorState(tab)
	state.Select(2, 7) // alpha
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("搜索"); err != nil {
		t.Fatal(err)
	}
	if count, _ := state.FindMatches(); count != 2 {
		t.Fatalf("search did not use the selected text: %d matches", count)
	}
	if _, ok := tt.Find("查找"); !ok {
		t.Fatal("search button did not open the native find bar")
	}
	tt.Key(0, ui.KeyEscape)
	if !tt.Focused("JSON 编辑器") || state.Buffer.CanUndo() {
		t.Fatal("closing search did not restore editor focus or added an undo step")
	}
}

func TestWrapButtonBackgroundFollowsEditorAndShortcut(t *testing.T) {
	for _, dark := range []bool{false, true} {
		app := newEditingApplication()
		first := app.activeTab
		tt := newWorkspaceTester(app, 1000, 650)
		tt.SetDark(dark)
		button, ok := tt.Find("自动换行")
		if !ok {
			t.Fatal("missing wrap button")
		}
		pixel := func() [4]uint8 {
			tt.Move(10, 600) // Compare the persistent face without hover paint.
			p := tt.Image().RGBAAt(int(button.X)+4, int(button.Y+button.H/2))
			return [4]uint8{p.R, p.G, p.B, p.A}
		}
		inactive := pixel()
		if err := tt.Click("自动换行"); err != nil {
			t.Fatal(err)
		}
		active := pixel()
		if !first.editor.WrapEnabled() || active == inactive {
			t.Fatal("enabled wrapping did not give the button a persistent background")
		}
		if err := tt.Click("新建格式化"); err != nil {
			t.Fatal(err)
		}
		if app.activeTab.editor.WrapEnabled() || pixel() != inactive {
			t.Fatal("wrap button did not reflect the selected editor")
		}
		if err := tt.Click(first.title); err != nil {
			t.Fatal(err)
		}
		if pixel() != active {
			t.Fatal("switching editors lost the active wrap button background")
		}
		tt.Key(ui.Cmd, ui.KeyK)
		tt.Key(0, ui.KeyZ)
		if first.editor.WrapEnabled() || pixel() != inactive {
			t.Fatal("the native wrap chord did not update the button's background")
		}
		// Cmd+K is shared by fold commands. Those must still work without
		// changing the wrap preference or swallowing later ordinary edits.
		tt.Key(ui.Cmd, ui.KeyK)
		tt.Key(ui.Cmd, ui.Key0)
		if len(editorState(first).Folded()) != 1 || first.editor.WrapEnabled() {
			t.Fatal("wrap shortcut handling broke the native folding chord")
		}
		version := editorState(first).Buffer.Version()
		tt.Key(ui.Cmd, ui.KeyK)
		tt.Key(0, ui.KeyA) // An unbound chord key cancels the chord.
		if editorState(first).Buffer.Version() != version || first.editor.WrapEnabled() {
			t.Fatal("an unbound chord changed text or wrapping")
		}
		tt.Key(ui.Cmd, ui.KeyA)
		tt.Type(`[]`)
		if editorState(first).Buffer.String() != `[]` {
			t.Fatal("a cancelled chord interfered with subsequent editing")
		}
	}
}
