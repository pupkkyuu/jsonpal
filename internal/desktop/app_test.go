package desktop

import (
	"strings"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/editor"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

func awaitTransform(t *testing.T, tt *ui.Tester, app *application) {
	t.Helper()
	work, ok := app.activeTab.editor.(interface{ Busy() bool })
	if !ok {
		return
	}
	deadline := time.Now().Add(3 * time.Second)
	for work.Busy() {
		if time.Now().After(deadline) {
			t.Fatal("background transformation did not finish")
		}
		tt.Frame()
		if work.Busy() {
			time.Sleep(time.Millisecond)
		}
	}
}

func TestFormatButtonAndUndo(t *testing.T) {
	app := newEditingApplication()
	const source = `{"Box":"It's bigger on the inside."}`
	editorState(app.activeTab).Buffer.Set(source)
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(app.activeTab).Buffer.String() != starterJSON || app.activeTab.editor.Result().Message != "JSON 有效，已格式化（2 空格缩进）" {
		t.Fatalf("format did not update the editor and status: %q, %q", editorState(app.activeTab).Buffer.String(), tt.Texts())
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("format should return focus to the editor")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if got := editorState(app.activeTab).Buffer.String(); got != source {
		t.Fatalf("undo formatting = %q; want original input", got)
	}
	if app.activeTab.editor.Result().Message != "内容已修改，按 ⌘⇧F 格式化" {
		t.Fatal("format success message is stale after undo")
	}
}

func TestEditAndFormatShortcut(t *testing.T) {
	app := newEditingApplication()
	tt := newApplicationTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"answer":42}`)
	if got := editorState(app.activeTab).Buffer.String(); got != `{"answer":42}` {
		t.Fatalf("typing into the native editor = %q", got)
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
	awaitTransform(t, tt, app)
	if got := editorState(app.activeTab).Buffer.String(); got != "{\n  \"answer\": 42\n}" {
		t.Fatalf("format shortcut = %q", got)
	}
}

func TestInvalidJSONDoesNotChangeContent(t *testing.T) {
	app := newEditingApplication()
	const invalid = "{\n  \"a\": ]\n}"
	editorState(app.activeTab).Buffer.Set(invalid)
	tt := newApplicationTester(app, 600, 400)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(app.activeTab).Buffer.String() != invalid || !app.activeTab.editor.Result().HasError || !strings.Contains(app.activeTab.editor.Result().Message, "第 2 行，第 8 列") {
		t.Fatalf("invalid format changed input or lost error: %q, %q", editorState(app.activeTab).Buffer.String(), app.activeTab.editor.Result().Message)
	}
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`[]`)
	if app.activeTab.editor.Result().HasError || app.activeTab.editor.Result().Message != "内容已修改，按 ⌘⇧F 格式化" {
		t.Fatal("format error is stale after editing")
	}
}

func TestEmptyAndUnchangedFormatting(t *testing.T) {
	app := newEditingApplication()
	editorState(app.activeTab).Buffer.Set(" \n ")
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(app.activeTab).Buffer.String() != " \n " || app.activeTab.editor.Result().HasError || app.activeTab.editor.Result().Message != "等待输入 JSON" {
		t.Fatal("empty input should stay unchanged and show the waiting message")
	}
	editorState(app.activeTab).Buffer.Set("{\n  \"a\": 1\n}")
	tt.Frame()
	version := editorState(app.activeTab).Buffer.Version()
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(app.activeTab).Buffer.Version() != version {
		t.Fatal("formatting unchanged input should not create an undo step")
	}
}

// Exercise the application's Shell slots without opening a native window.
// Shell owns its own sidebar lifecycle; the native smoke check covers that host.
func newApplicationTester(app *application, width, height int) *ui.Tester {
	options := app.shellOptions()
	tt := ui.NewTester(func(c *ui.Context) {
		c.SetTheme(options.Theme(c))
		ui.Column(c).Fill().Children(func() {
			options.Content(c)
			ui.Row(c).Absolute().Top(0).Left(0).Right(0).Height(sidebar.HeaderHeight(c)).Children(func() {
				options.ContentTitle(c)
			})
			ui.Row(c).Absolute().Bottom(0).Left(0).Width(220).Height(48).Children(func() {
				options.LeftToolbar(c)
			})
		})
	}, width, height)
	tt.SetLocale("zh-Hans")
	return tt
}

func TestDefaultThemeChangesPreserveEditing(t *testing.T) {
	app := newEditingApplication()
	tt := newApplicationTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"answer":42}`)
	selection := editorState(app.activeTab).Selection()
	background := tt.Image().RGBAAt(500, 300)
	tt.SetDark(true)
	if editorState(app.activeTab).Theme.Text != ui.Hex("#DCDCDC") || editorState(app.activeTab).Theme.TokenColor(editor.TokenString) != ui.Hex("#CE9178") {
		t.Fatal("editor did not switch to the requested vs-dark palette")
	}
	if tt.Image().RGBAAt(500, 300) == background {
		t.Fatal("editor did not inherit the default dark theme")
	}
	if editorState(app.activeTab).Buffer.String() != `{"answer":42}` || editorState(app.activeTab).Selection() != selection {
		t.Fatal("theme change altered editor content or selection")
	}
	tt.SetDark(false)
	if editorState(app.activeTab).Theme.Text != ui.Hex("#000000") || editorState(app.activeTab).Theme.TokenColor(editor.TokenString) != ui.Hex("#0451A5") {
		t.Fatal("editor did not restore the vs light palette")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(app.activeTab).Buffer.String() != starterJSON {
		t.Fatal("theme change lost editor undo history")
	}
}

func TestNarrowToolbarKeepsActionsReachable(t *testing.T) {
	app := newEditingApplication()
	tt := newApplicationTester(app, 400, 400)
	toolbar, ok := tt.Find("编辑工具栏")
	if !ok {
		t.Fatal("missing scrollable toolbar")
	}
	tt.Scroll(toolbar.X+toolbar.W/2, toolbar.Y+toolbar.H/2, 1000, 0)
	clear, ok := tt.Find("清空")
	if !ok || clear.X < toolbar.X || clear.X+clear.W > toolbar.X+toolbar.W {
		t.Fatalf("last toolbar action is unreachable: toolbar=%v clear=%v", toolbar, clear)
	}
	tt.Scroll(toolbar.X+toolbar.W/2, toolbar.Y+toolbar.H/2, -1000, 0)
	editorState(app.activeTab).Buffer.Set(`{"answer":42}`)
	tt.Frame()
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	awaitTransform(t, tt, app)
	if editorState(app.activeTab).Buffer.String() != "{\n  \"answer\": 42\n}" {
		t.Fatal("first toolbar action stopped working after horizontal scroll")
	}
}
