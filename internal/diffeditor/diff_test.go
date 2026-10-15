package diffeditor

import (
	"fmt"
	"testing"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
	"github.com/oneo-me/onevra/source/theme"
	"jsonpal/internal/editor"
)

func newDiffTester(d *Diff) *ui.Tester {
	return ui.NewTester(func(c *ui.Context) {
		theme.Apply(c, theme.Auto)
		ui.Column(c).Fill().Children(func() {
			ui.Row(c).Height(36).Children(func() { d.Toolbar(c) })
			d.View(c, editor.ViewOptions{Shortcuts: true})
		})
	}, 900, 650)
}

func TestTwoEditableDocumentsAndPreviewPreserveState(t *testing.T) {
	d := New("", "")
	tt := newDiffTester(d)
	if !tt.Focused("左侧 JSON 编辑器") {
		t.Fatal("new comparison did not focus the left input")
	}
	tt.Type(`{"a":1}`)
	if err := tt.Click("右侧 JSON 编辑器"); err != nil {
		t.Fatal(err)
	}
	tt.Type(`{"a":2}`)
	d.Right().State().Select(2, 5)
	tt.Frame()
	selection := d.Right().State().Selection()
	versions := [2]uint64{d.Left().State().Buffer.Version(), d.Right().State().Buffer.Version()}
	if err := tt.Click("对比 JSON"); err != nil {
		t.Fatal(err)
	}
	if !d.Comparing() || len(d.Hunks()) != 1 {
		t.Fatal("comparison did not display the changed JSON line")
	}
	if _, ok := tt.Find("JSON 差异预览"); !ok {
		t.Fatal("missing native split diff viewer")
	}
	for i, pane := range d.panes {
		if pane.State().Buffer.Version() != versions[i] {
			t.Fatal("entering preview changed source text")
		}
	}
	if err := tt.Click("编辑 JSON"); err != nil {
		t.Fatal(err)
	}
	if d.Comparing() || !tt.Focused("右侧 JSON 编辑器") || d.Right().State().Selection() != selection {
		t.Fatal("returning to edit lost the active side or selection")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if d.Right().State().Buffer.String() != "" || d.Left().State().Buffer.String() != `{"a":1}` {
		t.Fatal("preview changed or mixed the independent undo histories")
	}
	tt.SetDark(true)
	if d.Left().State().Theme.Text != ui.Hex("#DCDCDC") || d.Right().State().Theme.TokenColor(mygoeditor.TokenString) != ui.Hex("#CE9178") {
		t.Fatal("both input palettes did not follow the dark theme")
	}
}

func TestComparisonNavigationAndLiveRecalculation(t *testing.T) {
	left := "{\n  \"a\": 1,\n  \"b\": 2,\n  \"c\": 3,\n  \"d\": 4,\n  \"e\": 5,\n  \"f\": 6,\n  \"g\": 7\n}"
	right := "{\n  \"a\": 10,\n  \"b\": 2,\n  \"c\": 3,\n  \"d\": 4,\n  \"e\": 5,\n  \"f\": 6,\n  \"g\": 70\n}"
	d := New(left, right)
	tt := newDiffTester(d)
	if err := tt.Click("对比 JSON"); err != nil {
		t.Fatal(err)
	}
	if len(d.Hunks()) != 2 {
		t.Fatalf("expected two separated changes, got %v", d.Hunks())
	}
	for _, want := range []int{0, 1, 0} {
		if err := tt.Click("下一个差异"); err != nil {
			t.Fatal(err)
		}
		if d.currentHunk != want {
			t.Fatalf("next difference = %d; want %d", d.currentHunk, want)
		}
	}
	if err := tt.Click("上一个差异"); err != nil {
		t.Fatal(err)
	}
	if d.currentHunk != 1 {
		t.Fatal("previous difference did not wrap")
	}
	d.FoldAll()
	if d.preview.ExpandUnchanged {
		t.Fatal("fold all did not collapse unchanged context")
	}
	d.UnfoldAll()
	if !d.preview.ExpandUnchanged {
		t.Fatal("unfold all did not restore unchanged context")
	}
	d.Right().State().Buffer.Set(left)
	tt.Frame()
	if len(d.Hunks()) != 0 || d.currentHunk != -1 {
		t.Fatal("comparison did not recalculate after a source edit")
	}
	d.NextDifference()
	if d.currentHunk != -1 {
		t.Fatal("navigation should ignore identical documents")
	}
	d.Right().State().Buffer.Set(right)
	tt.Frame()
	if len(d.Hunks()) != 2 {
		t.Fatal("changed source did not restore differences")
	}
	// Native colors are visible, not just a difference count.
	red, green := 0, 0
	img := tt.Image()
	for y := 80; y < 320; y++ {
		for x := 70; x < 830; x++ {
			p := img.RGBAAt(x, y)
			if int(p.R)-int(p.G) > 20 && p.R > 160 {
				red++
			}
			if int(p.G)-int(p.R) > 20 && p.G > 130 {
				green++
			}
		}
	}
	if red == 0 || green == 0 {
		t.Fatalf("native deleted/added highlights missing: red=%d green=%d", red, green)
	}
}

func TestAtomicTwoSidedTransformsAndErrors(t *testing.T) {
	for _, operation := range []struct {
		name string
		run  func(*Diff)
	}{
		{"format", (*Diff).Format}, {"compact", (*Diff).Compact}, {"sort", (*Diff).SortFields},
	} {
		t.Run(operation.name, func(t *testing.T) {
			d := New(`{"b":2,"a":1}`, `{"bad":]}`)
			operation.run(d)
			if !d.Result().HasError || len(d.Right().State().Diagnostics()) != 1 || d.Left().State().Buffer.String() != `{"b":2,"a":1}` {
				t.Fatal("failure did not diagnose the invalid side or partially changed the valid side")
			}
			if d.Left().State().Buffer.CanUndo() || d.Right().State().Buffer.CanUndo() {
				t.Fatal("failed transform created undo history")
			}
			d.Right().State().Buffer.Set(`{"b":4,"a":3}`)
			operation.run(d)
			if d.Result().HasError || len(d.Right().State().Diagnostics()) != 0 {
				t.Fatal("successful retry left an old error")
			}
			d.ToggleComparison()
			before := d.Left().State().Buffer.String()
			operation.run(d)
			if d.Left().State().Buffer.String() != before {
				t.Fatal("text transforms should be ignored in preview")
			}
		})
	}
	d := New(`{"a":1}`, `{"a":2}`)
	d.Escape()
	d.Unescape()
	if d.Left().State().Buffer.String() != `{"a":1}` || d.Right().State().Buffer.String() != `{"a":2}` {
		t.Fatal("two-sided escape/unescape round trip failed")
	}
	d = New("", `{"a":1}`)
	d.Format()
	if d.Left().State().Buffer.String() != "" || d.Left().State().Buffer.CanUndo() || d.Right().State().Buffer.String() != "{\n  \"a\": 1\n}" {
		t.Fatal("empty side did not stay empty during a two-sided transform")
	}
}

func TestCopyClearWrapAndSearch(t *testing.T) {
	d := New(`{"left":1}`, `{"right":2}`)
	tt := newDiffTester(d)
	var copied string
	d.CopyAll(func(text string) { copied = text })
	if copied != "{\"left\":1}\n{\"right\":2}" {
		t.Fatal("copy did not concatenate both documents")
	}
	d.ToggleWrap()
	if !d.Left().WrapEnabled() || !d.Right().WrapEnabled() {
		t.Fatal("wrap did not apply to both input panes")
	}
	tt.Frame()
	tt.Key(ui.Cmd, ui.KeyK)
	tt.Key(0, ui.KeyZ)
	if d.Left().WrapEnabled() || d.Right().WrapEnabled() {
		t.Fatal("native wrap chord did not synchronize the two panes")
	}
	d.ToggleComparison()
	tt.Frame()
	d.ToggleWrap()
	tt.Frame()
	if !d.preview.Wrap {
		t.Fatal("preview wrapping did not follow the toolbar setting")
	}
	d.Search()
	tt.Frame()
	if d.Comparing() {
		t.Fatal("search should return to the editable document")
	}
	if _, ok := tt.Find("Find"); !ok {
		t.Fatal("search did not open the active document's find bar")
	}
	d.ToggleComparison()
	tt.Frame()
	d.Clear()
	tt.Frame()
	if d.Comparing() || !tt.Focused("左侧 JSON 编辑器") {
		t.Fatal("clear did not return to left input mode")
	}
	for i, pane := range d.panes {
		if pane.State().Buffer.String() != "" || len(pane.State().Diagnostics()) != 0 {
			t.Fatal("clear left text or diagnostics behind")
		}
		pane.State().Buffer.Undo()
		if pane.State().Buffer.String() != fmt.Sprintf(`{"%s":%d}`, []string{"left", "right"}[i], i+1) {
			t.Fatal("clear did not preserve each document's undo history")
		}
	}
}
