package editor

import (
	"strings"
	"testing"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
)

func TestFindBarHintsPreserveNativeSearchAndReplace(t *testing.T) {
	e := NewJSON(`{"a":"old","b":"old"}`)
	var find *mygoeditor.FindBar
	render := e.State().RenderFindBar
	e.State().RenderFindBar = func(c *ui.Context, bar ui.Element, f *mygoeditor.FindBar) {
		find = f
		render(c, bar, f)
	}
	tt := newJSONTester(e, 1000, 400)
	tt.Key(ui.Cmd|ui.Alt, ui.KeyF)
	if find == nil || !tt.Focused("查找") {
		t.Fatal("custom find renderer did not retain native query focus")
	}
	tt.Type("old")
	if count, _ := e.State().FindMatches(); count != 2 {
		t.Fatal("find input stopped updating native matches")
	}
	if !strings.Contains(find.Status(), "共 2 项") {
		t.Fatalf("native find status did not use Chinese resources: %q", find.Status())
	}
	if err := tt.Click("下一个匹配"); err != nil {
		t.Fatal(err)
	}
	*find.Replacement() = "new"
	tt.Frame()
	if err := tt.Click("全部替换"); err != nil {
		t.Fatal(err)
	}
	if e.State().Buffer.String() != `{"a":"new","b":"new"}` {
		t.Fatal("find renderer changed replace-all behavior")
	}
	if err := tt.Click("关闭"); err != nil {
		t.Fatal(err)
	}
	if !tt.Focused("JSON 编辑器") {
		t.Fatal("closing find did not restore native editor focus")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if e.State().Buffer.String() != `{"a":"old","b":"old"}` {
		t.Fatal("replace-all did not remain a single undoable edit")
	}
}
