package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestPendingTransformStaysWithItsTab(t *testing.T) {
	app := newApplication()
	first := app.addFormatTab(`{"first":1}`)
	first.editor.Format()
	second := app.addFormatTab(`{"second":2}`)
	tt := newWorkspaceTester(app, 1000, 650)
	if !tt.Focused("JSON 编辑器") || editorState(first).Buffer.String() != `{"first":1}` {
		t.Fatal("an unmounted editor applied a result or stole focus")
	}
	if err := tt.Click(first.title); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(first).Buffer.String() != "{\n  \"first\": 1\n}" || editorState(second).Buffer.String() != `{"second":2}` || editorState(second).Buffer.CanUndo() {
		t.Fatal("a pending operation was lost or applied to the selected tab instead of its owner")
	}
}

func TestClosingTabWithPendingTransformReturnsToWelcome(t *testing.T) {
	app := newApplication()
	tab := app.addFormatTab(`{"closed":1}`)
	tab.editor.Format()
	app.closeTab(tab.id)
	tt := newWorkspaceTester(app, 760, 400)
	if _, ok := tt.Find("欢迎背景"); !ok || len(app.tabs) != 0 || app.activeTab != nil {
		t.Fatal("closing a tab with background work did not return to welcome")
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	if editorState(app.activeTab).Buffer.String() != "" || editorState(app.activeTab).Buffer.CanUndo() {
		t.Fatal("a new document inherited the closed tab's pending operation")
	}
}

func TestTransformCompletionDoesNotTakeFocusFromSettings(t *testing.T) {
	app := newApplication()
	tab := app.addFormatTab(`{"a":1}`)
	tt := newWorkspaceTester(app, 1000, 650)
	tab.editor.Format()
	tt.Key(ui.Cmd, ui.KeyComma)
	awaitTransform(t, tt, app)
	if !app.settings.IsOpen() || tt.Focused("JSON 编辑器") || editorState(tab).Buffer.String() != "{\n  \"a\": 1\n}" {
		t.Fatal("completing a background operation disturbed the settings dialog")
	}
	if err := tt.Click("关闭设置"); err != nil {
		t.Fatal(err)
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("closing settings did not restore editor focus")
	}
}
