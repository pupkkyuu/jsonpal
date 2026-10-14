package main

import (
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/shells/sidebar"
	"github.com/oneo-me/onevra/source/theme"
)

func TestFormatButtonAndUndo(t *testing.T) {
	app := newApplication()
	const source = `{"Box":"It's bigger on the inside."}`
	app.code.Buffer.Set(source)
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if app.code.Buffer.String() != starterJSON || app.status != "JSON 有效，已格式化（2 空格缩进）" {
		t.Fatalf("format did not update the editor and status: %q, %q", app.code.Buffer.String(), tt.Texts())
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("format should return focus to the editor")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if got := app.code.Buffer.String(); got != source {
		t.Fatalf("undo formatting = %q; want original input", got)
	}
	if app.status != "内容已修改，按 ⌘⇧F 格式化" {
		t.Fatal("format success message is stale after undo")
	}
}

func TestEditAndFormatShortcut(t *testing.T) {
	app := newApplication()
	tt := newApplicationTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"answer":42}`)
	if got := app.code.Buffer.String(); got != `{"answer":42}` {
		t.Fatalf("typing into the native editor = %q", got)
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
	if got := app.code.Buffer.String(); got != "{\n  \"answer\": 42\n}" {
		t.Fatalf("format shortcut = %q", got)
	}
}

func TestInvalidJSONDoesNotChangeContent(t *testing.T) {
	app := newApplication()
	const invalid = "{\n  \"a\": ]\n}"
	app.code.Buffer.Set(invalid)
	tt := newApplicationTester(app, 600, 400)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if app.code.Buffer.String() != invalid || !app.hasError || !strings.Contains(app.status, "第 2 行，第 8 列") {
		t.Fatalf("invalid format changed input or lost error: %q, %q", app.code.Buffer.String(), app.status)
	}
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`[]`)
	if app.hasError || app.status != "内容已修改，按 ⌘⇧F 格式化" {
		t.Fatal("format error is stale after editing")
	}
}

func TestEmptyAndUnchangedFormatting(t *testing.T) {
	app := newApplication()
	app.code.Buffer.Set(" \n ")
	tt := newApplicationTester(app, 1000, 650)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if app.code.Buffer.String() != " \n " || app.hasError || app.status != "等待输入 JSON" {
		t.Fatal("empty input should stay unchanged and show the waiting message")
	}
	app.code.Buffer.Set("{\n  \"a\": 1\n}")
	tt.Frame()
	version := app.code.Buffer.Version()
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if app.code.Buffer.Version() != version {
		t.Fatal("formatting unchanged input should not create an undo step")
	}
}

// Exercise the application's Shell slots without opening a native window.
// Shell owns its own sidebar lifecycle; the native smoke check covers that host.
func newApplicationTester(app *application, width, height int) *ui.Tester {
	options := app.shellOptions()
	return ui.NewTester(func(c *ui.Context) {
		theme.Apply(c, options.Appearance)
		ui.Column(c).Fill().Children(func() {
			options.Content(c)
			ui.Row(c).Absolute().Top(0).Left(0).Right(0).Height(sidebar.HeaderHeight(c)).Children(func() {
				options.ContentTitle(c)
			})
		})
	}, width, height)
}

func TestDefaultThemeChangesPreserveEditing(t *testing.T) {
	app := newApplication()
	tt := newApplicationTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"answer":42}`)
	selection := app.code.Selection()
	background := tt.Image().RGBAAt(500, 300)
	tt.SetDark(true)
	if tt.Image().RGBAAt(500, 300) == background {
		t.Fatal("editor did not inherit the default dark theme")
	}
	if app.code.Buffer.String() != `{"answer":42}` || app.code.Selection() != selection {
		t.Fatal("theme change altered editor content or selection")
	}
	tt.SetDark(false)
	tt.Key(ui.Cmd, ui.KeyZ)
	if app.code.Buffer.String() != starterJSON {
		t.Fatal("theme change lost editor undo history")
	}
}

func TestNarrowToolbarKeepsActionsReachable(t *testing.T) {
	app := newApplication()
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
	app.code.Buffer.Set(`{"answer":42}`)
	tt.Frame()
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if app.code.Buffer.String() != "{\n  \"answer\": 42\n}" {
		t.Fatal("first toolbar action stopped working after horizontal scroll")
	}
}
