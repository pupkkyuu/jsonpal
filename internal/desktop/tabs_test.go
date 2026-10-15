package desktop

import (
	"bytes"
	"fmt"
	"image"
	"testing"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/shells/sidebar"

	"jsonpal/internal/diffeditor"
)

// Compose the real Shell slots with a sidebar to exercise tab navigation.
func newWorkspaceTester(app *application, width, height int) *ui.Tester {
	options := app.shellOptions()
	tt := ui.NewTester(func(c *ui.Context) {
		c.SetTheme(options.Theme(c))
		ui.Row(c).Fill().Children(func() {
			ui.Column(c.Key("left")).Width(220).Shrink(0).FillHeight().Children(func() {
				ui.Column(c).Grow(1).FillWidth().MinHeight(0).Children(func() { options.Left(c) })
				ui.Row(c).FillWidth().Height(48).Children(func() { options.LeftToolbar(c) })
			})
			ui.Column(c.Key("content")).Grow(1).MinWidth(0).FillHeight().Children(func() {
				options.Content(c)
				ui.Row(c).Absolute().Top(0).Left(0).Right(0).Height(sidebar.HeaderHeight(c)).Children(func() { options.ContentTitle(c) })
			})
		})
	}, width, height)
	tt.SetLocale("zh-Hans")
	return tt
}

func TestNewFormatTabsAndIndependentUndo(t *testing.T) {
	app := newEditingApplication()
	first := app.activeTab
	tt := newWorkspaceTester(app, 1000, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"first":1}`)
	editorState(first).Select(2, 7)
	tt.Frame()
	selection := editorState(first).Selection()
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	second := app.activeTab
	if second == first || second.title != "格式化 2" || editorState(second).Buffer.String() != "" || !tt.HasText("标签页（2）") || !tt.Focused("JSON 编辑器") {
		t.Fatal("new tab did not create and focus an empty document")
	}
	tt.Type(`{"second":2}`)
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if editorState(second).Buffer.String() != "{\n  \"second\": 2\n}" || editorState(first).Buffer.String() != `{"first":1}` {
		t.Fatal("formatting modified the wrong tab")
	}
	if err := tt.Click("格式化 1"); err != nil {
		t.Fatal(err)
	}
	if app.activeTab != first || editorState(first).Selection() != selection || !tt.Focused("JSON 编辑器") {
		t.Fatal("switching back did not restore the editor selection and focus")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(first).Buffer.String() != starterJSON || editorState(second).Buffer.String() != "{\n  \"second\": 2\n}" {
		t.Fatal("undo affected another tab")
	}
	if err := tt.Click("格式化 2"); err != nil {
		t.Fatal(err)
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(second).Buffer.String() != `{"second":2}` {
		t.Fatal("second tab lost its formatting undo history")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(second).Buffer.String() != "" {
		t.Fatal("second tab undo history contained the first document")
	}
	tt.Key(ui.Cmd, ui.KeyN)
	if len(app.tabs) != 3 || app.activeTab.title != "格式化 3" || editorState(app.activeTab).Buffer.String() != "" || !tt.HasText("标签页（3）") {
		t.Fatal("new-tab shortcut did not select the next numbered document")
	}
	tt.Key(ui.Cmd, ui.KeyComma)
	tt.Key(ui.Cmd, ui.KeyN)
	if len(app.tabs) != 3 {
		t.Fatal("new-tab shortcut ran behind the settings dialog")
	}
}

func TestTabShortcutsCycleMixedEditorsAndPreserveState(t *testing.T) {
	app := newEditingApplication()
	first := app.activeTab
	second := app.addFormatTab("")
	comparison := app.addComparisonTab(`{"left":1}`, `{"right":2}`)
	d := comparison.editor.(*diffeditor.Diff)
	d.ToggleComparison()
	app.selectTab(first.id)
	tt := newWorkspaceTester(app, 1200, 650)
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"edited":true}`)
	editorState(first).Select(2, 8)
	tt.Frame()
	selection := editorState(first).Selection()
	for _, want := range []*workspaceTab{second, comparison, first} {
		tt.Key(ui.Ctrl, ui.KeyTab)
		if app.activeTab != want {
			t.Fatalf("Ctrl+Tab selected %s; want %s", app.activeTab.title, want.title)
		}
	}
	if editorState(first).Selection() != selection || !tt.Focused("JSON 编辑器") || editorState(second).Buffer.String() != "" {
		t.Fatal("cycling changed selection, inserted a tab, or failed to restore focus")
	}
	for _, want := range []*workspaceTab{comparison, second, first} {
		tt.Key(ui.Ctrl|ui.Shift, ui.KeyTab)
		if app.activeTab != want {
			t.Fatalf("Ctrl+Shift+Tab selected %s; want %s", app.activeTab.title, want.title)
		}
		if want == comparison && (!d.Comparing() || !tt.Focused("JSON 差异预览")) {
			t.Fatal("cycling lost the comparison mode or preview focus")
		}
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if editorState(first).Buffer.String() != starterJSON {
		t.Fatal("keyboard tab switching lost the document undo history")
	}
	tt.Key(ui.Cmd, ui.KeyF)
	tt.Key(ui.Ctrl, ui.KeyTab)
	if app.activeTab != second || !tt.Focused("JSON 编辑器") {
		t.Fatal("tab shortcut did not work while the find input was focused")
	}
}

func TestTabShortcutsHandleEmptySingleAndModalWorkspaces(t *testing.T) {
	app := newApplication()
	tt := newWorkspaceTester(app, 1000, 650)
	for _, mods := range []ui.Modifiers{ui.Ctrl, ui.Ctrl | ui.Shift} {
		tt.Key(mods, ui.KeyTab)
	}
	if app.activeTab != nil || len(app.tabs) != 0 {
		t.Fatal("cycling on welcome created a document")
	}
	tt.Key(ui.Cmd, ui.KeyN)
	first := app.activeTab
	for _, mods := range []ui.Modifiers{ui.Ctrl, ui.Ctrl | ui.Shift} {
		tt.Key(mods, ui.KeyTab)
	}
	if app.activeTab != first || len(app.tabs) != 1 || editorState(first).Buffer.String() != "" {
		t.Fatal("cycling a single tab changed the document or workspace")
	}
	tt.Key(ui.Cmd, ui.KeyN)
	second := app.activeTab
	tt.Key(ui.Cmd, ui.KeyComma)
	for _, mods := range []ui.Modifiers{ui.Ctrl, ui.Ctrl | ui.Shift} {
		tt.Key(mods, ui.KeyTab)
	}
	if app.activeTab != second || !app.settings.IsOpen() {
		t.Fatal("tab switching ran behind the settings dialog")
	}
}

func TestTabsPreserveScrollSelectionAndSearch(t *testing.T) {
	app := newEditingApplication()
	first := app.activeTab
	var source bytes.Buffer
	source.WriteString("[\n")
	for i := 0; i < 200; i++ {
		if i > 0 {
			source.WriteString(",\n")
		}
		fmt.Fprintf(&source, "  \"item-%d\"", i)
	}
	source.WriteString("\n]")
	editorState(first).Buffer.Set(source.String())
	tt := newWorkspaceTester(app, 1000, 650)
	editorState(first).Find("item-150")
	editorState(first).ScrollTo(140)
	tt.Frame()
	selection := editorState(first).Selection()
	editorRect, ok := tt.Find("JSON 编辑器")
	if !ok {
		t.Fatal("missing editor")
	}
	// Compare the top rows of the editor, excluding the caret and scrollbars.
	crop := image.Rect(int(editorRect.X)+5, int(editorRect.Y)+3, int(editorRect.X)+350, int(editorRect.Y)+80)
	before := copyPixels(tt.Image(), crop)
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	second := app.activeTab
	editorState(second).Find("other-query")
	tt.Frame()
	if count, _ := editorState(second).FindMatches(); count != 0 {
		t.Fatal("new tab inherited the first tab search")
	}
	if err := tt.Click("格式化 1"); err != nil {
		t.Fatal(err)
	}
	tt.Frame()
	if editorState(first).Selection() != selection {
		t.Fatal("switching tabs lost the search selection")
	}
	if count, _ := editorState(first).FindMatches(); count != 1 {
		t.Fatal("switching tabs lost the find query")
	}
	if !bytes.Equal(before, copyPixels(tt.Image(), crop)) {
		t.Fatal("switching tabs changed the editor scroll position")
	}
}

func copyPixels(img *image.RGBA, r image.Rectangle) []byte {
	var result []byte
	for y := r.Min.Y; y < r.Max.Y; y++ {
		start := img.PixOffset(r.Min.X, y)
		result = append(result, img.Pix[start:start+r.Dx()*4]...)
	}
	return result
}

func TestNewTabsScrollIntoViewWithoutHidingActions(t *testing.T) {
	app := newEditingApplication()
	tt := newWorkspaceTester(app, 760, 400)
	for i := 0; i < 20; i++ {
		tt.Key(ui.Cmd, ui.KeyN)
	}
	active, ok := tt.Find(app.activeTab.title)
	list, hasList := tt.Find("标签列表")
	if !ok || !hasList || active.Y < list.Y || active.Y+active.H > list.Y+list.H {
		t.Fatalf("new tab not revealed: tab=%v list=%v", active, list)
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	if len(app.tabs) != 22 || app.activeTab.title != "格式化 22" {
		t.Fatal("new-tab action was hidden by the scrolled tab list")
	}
}
