package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
	"jsonpal/internal/editor"
)

const starterJSON = `{
  "Box": "It's bigger on the inside."
}`

// Existing editor interaction tests explicitly open a document. Production
// startup now has no tabs and renders the welcome background.
func newEditingApplication() *application {
	app := newApplication()
	app.addFormatTab(starterJSON)
	return app
}

func editorState(tab *workspaceTab) *mygoeditor.State {
	return tab.editor.(*editor.JSON).State()
}

// This editing surface deliberately has no single-document State method.
// Hosting and toolbar dispatch must work for a future multi-document editor.
type testEditor struct {
	formatCalls, compactCalls                                                            int
	foldCalls, unfoldCalls                                                               int
	wrapCalls, escapeCalls, unescapeCalls, copyCalls, sortCalls, searchCalls, clearCalls int
	options                                                                              editor.ViewOptions
}

func (e *testEditor) View(c *ui.Context, options editor.ViewOptions) {
	e.options = options
	ui.Box(c).Fill().Label("替代编辑器")
}
func (e *testEditor) Format()               { e.formatCalls++ }
func (e *testEditor) Compact()              { e.compactCalls++ }
func (e *testEditor) FoldAll()              { e.foldCalls++ }
func (e *testEditor) UnfoldAll()            { e.unfoldCalls++ }
func (e *testEditor) ToggleWrap()           { e.wrapCalls++ }
func (e *testEditor) WrapEnabled() bool     { return e.wrapCalls%2 != 0 }
func (e *testEditor) Escape()               { e.escapeCalls++ }
func (e *testEditor) Unescape()             { e.unescapeCalls++ }
func (e *testEditor) CopyAll(func(string))  { e.copyCalls++ }
func (e *testEditor) SortFields()           { e.sortCalls++ }
func (e *testEditor) Search()               { e.searchCalls++ }
func (e *testEditor) Clear()                { e.clearCalls++ }
func (e *testEditor) Result() editor.Result { return editor.Result{} }

func TestWorkspaceHostsEditorInterface(t *testing.T) {
	app := newEditingApplication()
	surface := &testEditor{}
	other := &workspaceTab{id: "other-editor", title: "其他编辑器", editor: surface}
	app.tabs = append(app.tabs, other)
	tt := newWorkspaceTester(app, 1000, 650)
	if err := tt.Click(other.title); err != nil {
		t.Fatal(err)
	}
	if app.activeTab != other || !tt.HasText(other.title) || !surface.options.Shortcuts {
		t.Fatal("workspace did not render the selected editor through its interface")
	}
	if _, ok := tt.Find("替代编辑器"); !ok {
		t.Fatal("workspace did not host the replacement editing surface")
	}
	if err := tt.Click("格式化 JSON"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("压缩"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("全部折叠"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("全部展开"); err != nil {
		t.Fatal(err)
	}
	if surface.formatCalls != 1 || surface.compactCalls != 1 || surface.foldCalls != 1 || surface.unfoldCalls != 1 {
		t.Fatal("toolbar actions were not dispatched to the active editor")
	}
	for _, label := range []string{"自动换行", "转义", "去转义", "复制", "字段排序", "搜索", "清空"} {
		if err := tt.Click(label); err != nil {
			t.Fatal(err)
		}
	}
	if surface.wrapCalls != 1 || surface.escapeCalls != 1 || surface.unescapeCalls != 1 || surface.copyCalls != 1 || surface.sortCalls != 1 || surface.searchCalls != 1 || surface.clearCalls != 1 {
		t.Fatal("new toolbar actions were not dispatched through the editor interface")
	}
	tt.Key(ui.Cmd, ui.KeyComma)
	if surface.options.Shortcuts {
		t.Fatal("workspace did not suspend editor shortcuts behind the settings modal")
	}
}
