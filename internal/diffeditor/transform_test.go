package diffeditor

import (
	"testing"
	"time"

	"jsonpal/internal/jsondoc"
)

func blockTransform(t *testing.T, d *Diff) func() {
	t.Helper()
	entered, release := make(chan struct{}, 2), make(chan struct{})
	d.transform(func(source string) (string, error) {
		entered <- struct{}{}
		<-release
		return jsondoc.Format(source)
	}, "formatted")
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("comparison worker did not start")
	}
	return func() { close(release) }
}

func TestEditingEitherSideDiscardsTheWholeTransform(t *testing.T) {
	for _, test := range []struct {
		name  string
		side  int
		right string
	}{
		{"edit left", 0, `{"right":2}`},
		{"edit right", 1, `{"right":2}`},
		{"stale error", 0, `{"right":]}`},
	} {
		t.Run(test.name, func(t *testing.T) {
			d := New(`{"left":1}`, test.right)
			tt := newDiffTester(d)
			release := blockTransform(t, d)
			// Rendering and editing continue before the worker is released.
			tt.Frame()
			if d.TransformEnabled() {
				t.Fatal("comparison transforms remained enabled while busy")
			}
			d.panes[test.side].State().Buffer.Set(`{"edited":true}`)
			var texts [2]string
			var versions [2]uint64
			for i, pane := range d.panes {
				texts[i], versions[i] = pane.State().Buffer.String(), pane.State().Buffer.Version()
			}
			release()
			awaitTransform(t, d)
			for i, pane := range d.panes {
				if pane.State().Buffer.String() != texts[i] || pane.State().Buffer.Version() != versions[i] || len(pane.State().Diagnostics()) != 0 {
					t.Fatal("a stale comparison result partially changed the pair or applied stale diagnostics")
				}
			}
			if d.Result().HasError {
				t.Fatal("a stale error replaced the new comparison status")
			}
		})
	}
}

func TestClearOrPreviewCancelsPendingComparisonTransform(t *testing.T) {
	for _, action := range []string{"clear", "preview"} {
		t.Run(action, func(t *testing.T) {
			d := New(`{"left":1}`, `{"right":2}`)
			release := blockTransform(t, d)
			if action == "clear" {
				d.Clear()
			} else {
				d.ToggleComparison()
			}
			var texts [2]string
			for i, pane := range d.panes {
				texts[i] = pane.State().Buffer.String()
			}
			release()
			awaitTransform(t, d)
			for i, pane := range d.panes {
				if pane.State().Buffer.String() != texts[i] {
					t.Fatal("a canceled comparison transform changed the documents")
				}
			}
			if d.Comparing() != (action == "preview") {
				t.Fatal("a canceled operation changed comparison mode")
			}
		})
	}
}

func TestLeftFailureDoesNotCommitTheOtherSide(t *testing.T) {
	d := New(`{"left":]}`, `{"right":2}`)
	d.Format()
	awaitTransform(t, d)
	if !d.Result().HasError || len(d.Left().State().Diagnostics()) != 1 || d.Right().State().Buffer.String() != `{"right":2}` || d.Right().State().Buffer.CanUndo() {
		t.Fatal("a left-side error failed to preserve and diagnose the pair")
	}
}
