package desktop

import (
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestCompactButtonUndoRedoAndTabIsolation(t *testing.T) {
	app := newEditingApplication()
	inactive := app.activeTab
	const source = "{\n  \"z\": 900719925474099312345,\n  \"text\": \" a b \"\n}"
	tab := app.addFormatTab(source)
	const want = `{"z":900719925474099312345,"text":" a b "}`
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("压缩"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(tab).Buffer.String() != want || tab.editor.Result().HasError || len(editorState(tab).Diagnostics()) != 0 {
		t.Fatalf("compact failed: %q, %q", editorState(tab).Buffer.String(), tab.editor.Result().Message)
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("compact should return focus to the editor")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(tab).Buffer.String() != source {
		t.Fatal("one undo should restore the entire original document")
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyZ)
	if editorState(tab).Buffer.String() != want {
		t.Fatal("redo should restore the compact document")
	}
	version := editorState(tab).Buffer.Version()
	if err := tt.Click("压缩"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(tab).Buffer.Version() != version {
		t.Fatal("already compact input should not create an undo step")
	}
	if editorState(inactive).Buffer.String() != starterJSON || editorState(inactive).Buffer.CanUndo() {
		t.Fatal("compact affected an inactive tab")
	}
}

func TestCompactProtectsInvalidAndEmptyInput(t *testing.T) {
	for _, source := range []string{"{\n  \"中文😀\": ]\n}", " \n \t"} {
		app := newEditingApplication()
		tab := app.addFormatTab(source)
		tt := newApplicationTester(app, 1000, 650)
		version := editorState(tab).Buffer.Version()
		if err := tt.Click("压缩"); err != nil {
			t.Fatal(err)
		}
		awaitTransform(t, tt, app)
		if editorState(tab).Buffer.String() != source || editorState(tab).Buffer.Version() != version || editorState(tab).Buffer.CanUndo() {
			t.Fatal("compact changed invalid or empty input or created an undo step")
		}
		if editorState(tab).Cursor() != 0 || len(editorState(tab).Selections()) != 1 {
			t.Fatal("compact did not return to the document start on invalid or empty input")
		}
		if strings.TrimSpace(source) == "" {
			if tab.editor.Result().HasError || len(editorState(tab).Diagnostics()) != 0 {
				t.Fatal("empty input should not report an error")
			}
		} else {
			diagnostics := editorState(tab).Diagnostics()
			if !tab.editor.Result().HasError || len(diagnostics) != 1 || !strings.Contains(diagnostics[0].Message, "第 2 行，第 10 列") {
				t.Fatalf("invalid input was not diagnosed immediately: %v", diagnostics)
			}
			tt.Key(ui.Cmd, ui.KeyA)
			tt.Type(` { "fixed": true } `)
			if err := tt.Click("压缩"); err != nil {
				t.Fatal(err)
			}
			awaitTransform(t, tt, app)
			if editorState(tab).Buffer.String() != `{"fixed":true}` || tab.editor.Result().HasError || len(editorState(tab).Diagnostics()) != 0 {
				t.Fatal("successful compact did not clear previous error diagnostics")
			}
		}
	}
}
