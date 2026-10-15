package setting

import (
	"testing"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/theme"
)

func TestPanelWorksWithoutWorkspace(t *testing.T) {
	var changes []mygo.ThemeSource
	panel := NewPanel(mygo.ThemeSystem, func(source mygo.ThemeSource) {
		changes = append(changes, source)
	})
	tt := ui.NewTester(func(c *ui.Context) {
		theme.Apply(c, theme.Auto)
		panel.View(c)
	}, 760, 400)
	tt.SetPreferences(ui.Preferences{ReduceMotion: true})
	panel.Open()
	tt.Frame()
	for _, label := range []string{"主题选择", "关闭设置", "搜索设置"} {
		r, ok := tt.Find(label)
		if !ok || r.X < 0 || r.Y < 0 || r.X+r.W > 760 || r.Y+r.H > 400 {
			t.Fatalf("settings control %q is outside the viewport: %v", label, r)
		}
	}
	if err := tt.Click("主题选择"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("夜晚"); err != nil {
		t.Fatal(err)
	}
	if panel.Appearance() != mygo.ThemeDark || len(changes) != 1 || changes[0] != mygo.ThemeDark {
		t.Fatal("theme selection did not update the preference and notify the host")
	}
	tt.Key(0, ui.KeyEscape)
	if panel.IsOpen() {
		t.Fatal("Escape did not close the standalone panel")
	}
	panel.Open()
	tt.Frame()
	if !tt.HasText("夜晚") || len(changes) != 1 {
		t.Fatal("reopening lost the preference or reapplied an unchanged theme")
	}
	if err := tt.Click("关闭设置"); err != nil {
		t.Fatal(err)
	}
	if panel.IsOpen() {
		t.Fatal("close button did not close the standalone panel")
	}
}
