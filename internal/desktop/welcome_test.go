package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
	"jsonpal/internal/diffeditor"
)

func TestStartupWelcomeAndFirstFormatDocument(t *testing.T) {
	app := newApplication()
	tt := newWorkspaceTester(app, 1000, 650)
	if len(app.tabs) != 0 || app.activeTab != nil || !tt.HasText("标签页（0）") {
		t.Fatal("startup should have no document and show an empty tab list")
	}
	if _, ok := tt.Find("欢迎背景"); !ok {
		t.Fatal("startup did not render the welcome background")
	}
	for _, label := range []string{"JSON 编辑器", "左侧 JSON 编辑器", "编辑工具栏"} {
		if _, ok := tt.Find(label); ok {
			t.Fatalf("startup mounted %q before a document was opened", label)
		}
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	if len(app.tabs) != 1 || app.activeTab.title != "格式化 1" || editorState(app.activeTab).Buffer.String() != "" || !tt.Focused("JSON 编辑器") {
		t.Fatal("first document did not open empty and focus the editor")
	}
	if _, ok := tt.Find("欢迎背景"); ok {
		t.Fatal("welcome background remained mounted over the editor")
	}
	tt.Type(`{"value":1}`)
	tt.Key(ui.Cmd, ui.KeyN)
	if len(app.tabs) != 2 || app.activeTab.title != "格式化 2" || editorState(app.tabs[0]).Buffer.String() != `{"value":1}` {
		t.Fatal("welcome transition interfered with normal tab creation or editing")
	}
}

func TestWelcomeCanOpenComparisonAndSettings(t *testing.T) {
	app := newApplication()
	tt := newWorkspaceTester(app, 760, 400)
	tt.SetPreferences(ui.Preferences{ReduceMotion: true})
	before := tt.Image().RGBAAt(700, 200)
	tt.SetDark(true)
	if tt.Image().RGBAAt(700, 200) == before {
		t.Fatal("welcome background did not follow the dark theme")
	}
	tt.Key(ui.Cmd, ui.KeyComma)
	if !app.settings.IsOpen() || !tt.HasText("主题") || app.activeTab != nil {
		t.Fatal("opening settings from welcome created a document or failed to open")
	}
	if err := tt.Click("关闭设置"); err != nil {
		t.Fatal(err)
	}
	if _, ok := tt.Find("欢迎背景"); !ok {
		t.Fatal("closing settings did not return to welcome")
	}
	if err := tt.Click("新建对比"); err != nil {
		t.Fatal(err)
	}
	d, ok := app.activeTab.editor.(*diffeditor.Diff)
	if !ok || len(app.tabs) != 1 || app.activeTab.title != "对比 1" || d.Left().State().Buffer.String() != "" || d.Right().State().Buffer.String() != "" || !tt.Focused("左侧 JSON 编辑器") {
		t.Fatal("welcome could not open a new comparison editor")
	}
}

func TestNewDocumentShortcutFromWelcome(t *testing.T) {
	app := newApplication()
	tt := newWorkspaceTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyN)
	if app.activeTab == nil || app.activeTab.title != "格式化 1" || !tt.Focused("JSON 编辑器") {
		t.Fatal("new-document shortcut did not work without a focused editor")
	}
}
