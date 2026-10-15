package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func hoverTab(t *testing.T, tt *ui.Tester, title string) {
	t.Helper()
	row, ok := tt.Find(title)
	if !ok {
		t.Fatalf("missing tab %q", title)
	}
	tt.Move(row.X+row.W/2, row.Y+row.H/2)
}

func TestCloseTabButtonAndActiveNeighbor(t *testing.T) {
	for _, test := range []struct {
		name                 string
		active, closed, next int
	}{
		{"inactive tab preserves active editor", 0, 2, 0},
		{"active middle selects right neighbor", 1, 1, 2},
		{"active last selects left neighbor", 2, 2, 1},
		{"active first selects right neighbor", 0, 0, 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			app := newEditingApplication()
			first := app.activeTab
			second := app.addFormatTab(`{"second":2}`)
			third := app.addFormatTab(`{"third":3}`)
			tabs := []*workspaceTab{first, second, third}
			closed, next := tabs[test.closed], tabs[test.next]
			app.selectTab(tabs[test.active].id)
			nextState := editorState(next)
			nextState.Select(2, 5)
			selection := nextState.Selection()
			tt := newWorkspaceTester(app, 1000, 650)
			hoverTab(t, tt, closed.title)
			if err := tt.Click("关闭 " + closed.title); err != nil {
				t.Fatal(err)
			}
			if len(app.tabs) != 2 || app.activeTab != next || !tt.HasText("标签页（2）") {
				t.Fatalf("closing selected the wrong editor: active=%s count=%d", app.activeTab.title, len(app.tabs))
			}
			for _, tab := range app.tabs {
				if tab == closed {
					t.Fatal("closed tab remained in the workspace")
				}
			}
			if _, ok := tt.Find("关闭 " + closed.title); ok {
				t.Fatal("closed tab's button remained visible")
			}
			if nextState.Selection() != selection || !tt.Focused("JSON 编辑器") {
				t.Fatal("closing a tab lost the remaining editor's selection or focus")
			}
		})
	}
}

func TestClosingLastTabCreatesFreshEmptyEditor(t *testing.T) {
	app := newEditingApplication()
	old := app.activeTab
	tt := newWorkspaceTester(app, 760, 400)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"edited":true}`)
	hoverTab(t, tt, old.title)
	if err := tt.Click("关闭 " + old.title); err != nil {
		t.Fatal(err)
	}
	newTab := app.activeTab
	if len(app.tabs) != 1 || newTab == old || newTab.id == old.id || newTab.title != "格式化 2" || !tt.HasText("标签页（1）") {
		t.Fatal("closing the last tab did not create a uniquely numbered replacement")
	}
	state := editorState(newTab)
	if state.Buffer.String() != "" || state.Buffer.CanUndo() || len(state.Diagnostics()) != 0 || !tt.Focused("JSON 编辑器") {
		t.Fatal("replacement editor inherited closed document state")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if state.Buffer.String() != "" {
		t.Fatal("replacement editor's undo restored a closed document")
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	if app.activeTab.title != "格式化 3" || len(app.tabs) != 2 {
		t.Fatal("new tab numbering was reused after closing the last tab")
	}
}

func TestCloseButtonRemainsReachableInScrolledTabList(t *testing.T) {
	app := newEditingApplication()
	for i := 0; i < 20; i++ {
		app.addFormatTab("")
	}
	active := app.activeTab
	tt := newWorkspaceTester(app, 760, 400)
	hoverTab(t, tt, active.title)
	button, ok := tt.Find("关闭 " + active.title)
	list, hasList := tt.Find("标签列表")
	if !ok || !hasList || button.X < list.X || button.X+button.W > list.X+list.W || button.Y < list.Y || button.Y+button.H > list.Y+list.H {
		t.Fatalf("close button is clipped: button=%v list=%v", button, list)
	}
	if err := tt.Click("关闭 " + active.title); err != nil {
		t.Fatal(err)
	}
	if len(app.tabs) != 20 || app.activeTab.title != "格式化 20" {
		t.Fatal("closing a scrolled tab did not reveal its preceding neighbor")
	}
	hoverTab(t, tt, app.activeTab.title)
	if err := tt.Click("关闭 " + app.activeTab.title); err != nil {
		t.Fatal(err)
	}
	if len(app.tabs) != 19 {
		t.Fatal("the neighboring tab's close button was not reachable")
	}
}
