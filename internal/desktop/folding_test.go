package desktop

import (
	"slices"
	"testing"

	"github.com/egoist/mygo/ui"
)

const nestedJSON = `{
  "nested": {
    "items": [
      {
        "value": 1
      }
    ]
  },
  "tail": [
    2,
    3
  ]
}`

func TestFoldButtonsPreserveDocumentsAndIndependentState(t *testing.T) {
	app := newEditingApplication()
	first := app.activeTab
	state := editorState(first)
	state.Buffer.Set(nestedJSON)
	version := state.Buffer.Version()
	tt := newWorkspaceTester(app, 1000, 650)
	wantFolds := []int{0, 1, 2, 3, 8}
	for i := 0; i < 2; i++ {
		if err := tt.Click("全部折叠"); err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(state.Folded(), wantFolds) || !tt.Focused("JSON 编辑器") {
			t.Fatalf("fold all did not collapse every nested region and retain focus: %v", state.Folded())
		}
	}
	if err := tt.Click("新建格式化"); err != nil {
		t.Fatal(err)
	}
	second := app.activeTab
	secondState := editorState(second)
	secondState.Buffer.Set(nestedJSON)
	tt.Frame()
	if len(secondState.Folded()) != 0 {
		t.Fatal("new editor inherited another editor's folds")
	}
	if err := tt.Click("全部折叠"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click(first.title); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(state.Folded(), wantFolds) {
		t.Fatal("switching editors lost folded regions")
	}
	for i := 0; i < 2; i++ {
		if err := tt.Click("全部展开"); err != nil {
			t.Fatal(err)
		}
		if len(state.Folded()) != 0 || !tt.Focused("JSON 编辑器") {
			t.Fatal("unfold all did not reveal every region and retain focus")
		}
	}
	if !slices.Equal(secondState.Folded(), wantFolds) {
		t.Fatal("unfold all affected an inactive editor")
	}
	if state.Buffer.String() != nestedJSON || state.Buffer.Version() != version || secondState.Buffer.String() != nestedJSON {
		t.Fatal("folding or unfolding changed document content")
	}
	tt.Key(ui.Cmd, ui.KeyZ)
	if state.Buffer.String() != starterJSON {
		t.Fatal("folding or unfolding changed the document undo history")
	}
}

func TestFoldButtonsOnDocumentsWithoutFoldableRegions(t *testing.T) {
	for _, source := range []string{"", `true`, `{"a":[1,2]}`} {
		app := newEditingApplication()
		tab := app.addFormatTab(source)
		state := editorState(tab)
		version := state.Buffer.Version()
		tt := newApplicationTester(app, 1000, 650)
		for _, label := range []string{"全部折叠", "全部展开"} {
			if err := tt.Click(label); err != nil {
				t.Fatal(err)
			}
			if len(state.Folded()) != 0 || state.Buffer.String() != source || state.Buffer.Version() != version || state.Buffer.CanUndo() {
				t.Fatalf("%s changed a document without foldable regions: %q", label, source)
			}
		}
	}
}
