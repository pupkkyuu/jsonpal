package desktop

import (
	"testing"

	"github.com/egoist/mygo/ui"
	"jsonpal/internal/diffeditor"
)

func TestNewComparisonButtonAndWorkspaceIntegration(t *testing.T) {
	app := newEditingApplication()
	formatTab := app.activeTab
	tt := newWorkspaceTester(app, 1200, 650)
	if err := tt.Click("新建对比"); err != nil {
		t.Fatal(err)
	}
	first := app.activeTab
	d, ok := first.editor.(*diffeditor.Diff)
	if !ok || first.title != "对比 1" || len(app.tabs) != 2 || !tt.HasText("标签页（2）") || !tt.Focused("左侧 JSON 编辑器") {
		t.Fatal("new comparison did not create a distinct editor and focus its left input")
	}
	if d.Left().State().Buffer.String() != "" || d.Right().State().Buffer.String() != "" {
		t.Fatal("new comparison should have two empty documents")
	}
	tt.Type(`{"value":1}`)
	if err := tt.Click("右侧 JSON 编辑器"); err != nil {
		t.Fatal(err)
	}
	tt.Type(`{"value":2}`)
	tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
	left, right := d.Left().State().Buffer.String(), d.Right().State().Buffer.String()
	if left != "{\n  \"value\": 1\n}" || right != "{\n  \"value\": 2\n}" {
		t.Fatal("workspace format shortcut did not transform both comparison documents")
	}
	clipboard := tt.Clipboard()
	if err := tt.Click("复制"); err != nil {
		t.Fatal(err)
	}
	if tt.Clipboard() != clipboard {
		t.Fatal("disabled copy changed the clipboard in comparison input mode")
	}
	if err := tt.Click("对比 JSON"); err != nil {
		t.Fatal(err)
	}
	if !d.Comparing() || len(d.Hunks()) != 1 {
		t.Fatal("workspace comparison button did not enable the native diff preview")
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyF)
	if d.Left().State().Buffer.String() != left || d.Right().State().Buffer.String() != right {
		t.Fatal("format ran in preview mode")
	}
	if err := tt.Click("复制"); err != nil {
		t.Fatal(err)
	}
	if tt.Clipboard() != clipboard {
		t.Fatal("disabled copy changed the clipboard in comparison preview mode")
	}
	if err := tt.Click("自动换行"); err != nil {
		t.Fatal(err)
	}
	if !d.WrapEnabled() {
		t.Fatal("workspace wrap action did not reach the comparison editor")
	}
	if err := tt.Click(formatTab.title); err != nil {
		t.Fatal(err)
	}
	if editorState(formatTab).Buffer.String() != starterJSON || formatTab.editor.WrapEnabled() {
		t.Fatal("comparison operations leaked into the single-document editor")
	}
	if _, ok := tt.Find("对比 JSON"); ok {
		t.Fatal("comparison-specific toolbar controls appeared on a format editor")
	}
	if err := tt.Click(first.title); err != nil {
		t.Fatal(err)
	}
	if !d.Comparing() || !d.WrapEnabled() || d.Left().State().Buffer.String() != left || d.Right().State().Buffer.String() != right {
		t.Fatal("switching tabs lost comparison content or mode")
	}
	if err := tt.Click("新建对比"); err != nil {
		t.Fatal(err)
	}
	second := app.activeTab
	if second.title != "对比 2" || second.id == first.id || len(app.tabs) != 3 {
		t.Fatal("comparison numbering or identity was not independent")
	}
	hoverTab(t, tt, second.title)
	if err := tt.Click("关闭 " + second.title); err != nil {
		t.Fatal(err)
	}
	if app.activeTab != first || len(app.tabs) != 2 || !d.Comparing() {
		t.Fatal("closing a comparison did not restore the adjacent comparison")
	}
	if err := tt.Click("清空"); err != nil {
		t.Fatal(err)
	}
	if d.Comparing() || d.Left().State().Buffer.String() != "" || d.Right().State().Buffer.String() != "" || !tt.Focused("左侧 JSON 编辑器") {
		t.Fatal("workspace clear did not reset both sides and return to input mode")
	}
}

func TestComparisonInputsFitNarrowWorkspace(t *testing.T) {
	app := newEditingApplication()
	app.addComparisonTab("", "")
	tt := newWorkspaceTester(app, 760, 400)
	left, hasLeft := tt.Find("左侧 JSON 编辑器")
	right, hasRight := tt.Find("右侧 JSON 编辑器")
	if !hasLeft || !hasRight || left.W <= 0 || right.W <= 0 || left.X+left.W > right.X || right.X+right.W > 760 || left.Y+left.H > 400 || right.Y+right.H > 400 {
		t.Fatalf("two inputs do not fit a narrow workspace: left=%v right=%v", left, right)
	}
	if err := tt.Click("对比 JSON"); err != nil {
		t.Fatal(err)
	}
	preview, ok := tt.Find("JSON 差异预览")
	if !ok || preview.W <= 0 || preview.H <= 0 || preview.X+preview.W > 760 || preview.Y+preview.H > 400 {
		t.Fatalf("split diff does not fit a narrow workspace: %v", preview)
	}
}
