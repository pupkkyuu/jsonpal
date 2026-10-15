package desktop

import (
	"testing"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/egoist/mygo/ui/editor"
	"jsonpal/internal/setting"
)

func TestSettingsThemeSelectionAndEditorState(t *testing.T) {
	app := newEditingApplication()
	var applied mygo.ThemeSource
	app.settings = setting.NewPanel(mygo.Theme.Source(), func(source mygo.ThemeSource) { applied = source })
	tt := newApplicationTester(app, 1000, 650)
	tt.SetPreferences(ui.Preferences{ReduceMotion: true})
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"answer":42}`)
	selection := editorState(app.activeTab).Selection()
	if err := tt.Click("设置"); err != nil {
		t.Fatal(err)
	}
	if !app.settings.IsOpen() || !tt.HasText("主题") {
		t.Fatal("settings entry did not open the theme setting")
	}
	for _, choice := range []struct {
		label  string
		source mygo.ThemeSource
		dark   bool
	}{
		{"夜晚", mygo.ThemeDark, true},
		{"明亮", mygo.ThemeLight, false},
		{"自动", mygo.ThemeSystem, true},
	} {
		if err := tt.Click("主题选择"); err != nil {
			t.Fatal(err)
		}
		if err := tt.Click(choice.label); err != nil {
			t.Fatal(err)
		}
		if applied != choice.source || app.settings.Appearance() != choice.source {
			t.Fatalf("%s did not update the native appearance source", choice.label)
		}
		// Simulate the platform theme event delivered after SetSource.
		tt.SetDark(choice.dark)
		want := "#0451A5"
		if choice.dark {
			want = "#CE9178"
		}
		if editorState(app.activeTab).Theme.TokenColor(editor.TokenString) != ui.Hex(want) {
			t.Fatal("editor highlighting did not follow the selected appearance")
		}
		if editorState(app.activeTab).Buffer.String() != `{"answer":42}` || editorState(app.activeTab).Selection() != selection {
			t.Fatal("settings interaction changed editor content or selection")
		}
	}
	if err := tt.Click("关闭设置"); err != nil {
		t.Fatal(err)
	}
	if app.settings.IsOpen() || !tt.Focused("JSON 编辑器") {
		t.Fatal("closing settings did not restore editor focus")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(app.activeTab).Buffer.String() != starterJSON {
		t.Fatal("settings interaction lost editor undo history")
	}
	tt.Key(ui.Cmd, ui.KeyComma)
	if !app.settings.IsOpen() || app.settings.Appearance() != mygo.ThemeSystem {
		t.Fatal("settings shortcut did not reopen with the previous preference")
	}
	tt.Key(0, ui.KeyEscape)
	if app.settings.IsOpen() {
		t.Fatal("Escape did not close settings")
	}
}

func TestSettingsDialogFitsNarrowWindow(t *testing.T) {
	app := newEditingApplication()
	tt := newApplicationTester(app, 760, 400)
	tt.SetPreferences(ui.Preferences{ReduceMotion: true})
	tt.Key(ui.Cmd, ui.KeyComma)
	for _, label := range []string{"主题选择", "关闭设置", "搜索设置"} {
		r, ok := tt.Find(label)
		if !ok || r.X < 0 || r.Y < 0 || r.X+r.W > 760 || r.Y+r.H > 400 {
			t.Fatalf("settings control %q is outside the viewport: %v", label, r)
		}
	}
	tt.ClickAt(2, 2)
	if app.settings.IsOpen() {
		t.Fatal("clicking the backdrop did not close settings")
	}
}
