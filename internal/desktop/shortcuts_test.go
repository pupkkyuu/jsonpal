package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/shells/sidebar"
	"github.com/oneo-me/onevra/source/theme"

	"jsonpal/internal/diffeditor"
)

func TestSidebarShortcutTracksShellAndSuspendsForSettings(t *testing.T) {
	app := newApplication()
	// The public Shell state API works without creating a native window.
	app.shell = &sidebar.Shell{}
	app.shell.SetLeftExpanded(true)
	app.shell.SetLeftWidth(240)
	tt := newWorkspaceTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyB)
	if app.shell.LeftExpanded() || app.activeTab != nil {
		t.Fatal("sidebar shortcut failed on welcome or created a document")
	}
	tt.Key(ui.Cmd, ui.KeyB)
	if !app.shell.LeftExpanded() || app.shell.LeftWidth() != 240 {
		t.Fatal("sidebar shortcut did not restore the sidebar and its chosen width")
	}
	tt.Key(ui.Cmd, ui.KeyN)
	tt.Type(`{"value":1}`)
	state := editorState(app.activeTab)
	selection := state.Selection()
	// The button also uses SetLeftExpanded; simulate its change before the key.
	app.shell.SetLeftExpanded(false)
	tt.Key(ui.Cmd, ui.KeyB)
	if !app.shell.LeftExpanded() || state.Buffer.String() != `{"value":1}` || state.Selection() != selection || !tt.Focused("JSON 编辑器") {
		t.Fatal("sidebar shortcut drifted from Shell state or changed the editor")
	}
	tt.Key(ui.Cmd, ui.KeyComma)
	tt.Key(ui.Cmd, ui.KeyB)
	if !app.settings.IsOpen() || !app.shell.LeftExpanded() {
		t.Fatal("sidebar shortcut ran behind the settings dialog")
	}
	if app.shellOptions().LeftToggleLabel != "侧边栏（⌘B）" {
		t.Fatal("sidebar button is missing its shortcut hint")
	}
}

func TestToolbarShortcutTooltipsFollowEditorMode(t *testing.T) {
	for _, mode := range []string{"json", "diff-input", "diff-preview"} {
		t.Run(mode, func(t *testing.T) {
			app := newEditingApplication()
			if mode != "json" {
				tab := app.addComparisonTab(`{"a":1}`, `{"a":2}`)
				if mode == "diff-preview" {
					tab.editor.(*diffeditor.Diff).ToggleComparison()
				}
			}
			tt := ui.NewTester(func(c *ui.Context) {
				theme.Apply(c)
				ui.Row(c).FillWidth().Height(48).Children(func() { app.titlebar(c) })
			}, 1200, 200)
			seen := map[string]bool{}
			for i := 0; i < 20; i++ {
				tt.Key(0, ui.KeyTab)
				for _, text := range tt.Texts() {
					seen[text] = true
				}
			}
			if !seen["搜索（⌘F）"] {
				t.Fatal("search tooltip did not show its shortcut")
			}
			if seen["格式化 JSON（⌘⇧F）"] != (mode != "diff-preview") ||
				seen["自动换行（⌘K → Z）"] != (mode != "diff-preview") ||
				seen["全部折叠（⌘K → ⌘0）"] != (mode == "json") ||
				seen["全部展开（⌘K → ⌘J）"] != (mode == "json") {
				t.Fatalf("shortcut hints did not match the active mode: %v", seen)
			}
			if seen["复制（⌘C）"] {
				t.Fatal("copy-all tooltip incorrectly advertised selection copy")
			}
		})
	}
}
