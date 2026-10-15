package editor

import (
	"testing"
	"time"

	"github.com/egoist/mygo/ui"

	"jsonpal/internal/jsondoc"
	"jsonpal/locales"
)

func awaitWorker(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("background transformation did not signal completion")
	}
}

func TestTransformRunsOutsideFramesAndRejectsDuplicateRequests(t *testing.T) {
	e := NewJSON(`{"a":1}`)
	tt := newJSONTester(e, 600, 400)
	entered, release := make(chan struct{}), make(chan struct{})
	defer func() {
		close(release)
		awaitTransform(t, tt, e)
	}()
	e.startTransform(func(source string) (string, error) {
		close(entered)
		<-release
		return jsondoc.Format(source)
	}, "first operation", false)
	awaitWorker(t, entered)
	resultChannel := e.transform.results
	// These frames and input must work while the transform is still blocked.
	tt.Frame()
	tt.Key(ui.Cmd, ui.KeyA)
	tt.Type(`{"new":2}`)
	e.Format()
	e.Compact()
	if !e.Busy() || e.TransformEnabled() || e.transform.results != resultChannel || e.transformMessage != "first operation" {
		t.Fatal("a duplicate request started another worker or replaced the pending operation")
	}
	if e.State().Buffer.String() != `{"new":2}` {
		t.Fatal("background work blocked editing")
	}
}

func TestStaleTransformChangesNeitherDocumentNorDiagnostics(t *testing.T) {
	for _, source := range []string{`{"a":1}`, `{"a":]}`} {
		t.Run(source, func(t *testing.T) {
			e := NewJSON(source)
			tt := newJSONTester(e, 600, 400)
			entered, release := make(chan struct{}), make(chan struct{})
			e.startTransform(func(source string) (string, error) {
				close(entered)
				<-release
				return jsondoc.Format(source)
			}, "formatted", true)
			awaitWorker(t, entered)
			tt.Key(ui.Cmd, ui.KeyA)
			tt.Type(`{"new":true}`)
			e.State().Select(2, 5)
			selection, version := e.State().Selection(), e.State().Buffer.Version()
			close(release)
			awaitTransform(t, tt, e)
			if e.State().Buffer.String() != `{"new":true}` || e.State().Buffer.Version() != version || e.State().Selection() != selection {
				t.Fatal("a stale result changed the new document or its selection")
			}
			if len(e.State().Diagnostics()) != 0 || e.Result().HasError || e.Result().Message != locales.EditorModifiedHint() {
				t.Fatal("a stale result replaced the new document's diagnostics or status")
			}
		})
	}
}

func TestClearCancelsPendingTransformWithoutAVersionChange(t *testing.T) {
	e := NewJSON("")
	tt := newJSONTester(e, 600, 400)
	entered, release := make(chan struct{}), make(chan struct{})
	e.startTransform(func(source string) (string, error) {
		close(entered)
		<-release
		return jsondoc.Escape(source)
	}, "escaped", false)
	awaitWorker(t, entered)
	version := e.State().Buffer.Version()
	e.Clear()
	if e.State().Buffer.Version() != version {
		t.Fatal("clearing an empty document should not change its version")
	}
	close(release)
	awaitTransform(t, tt, e)
	if e.State().Buffer.String() != "" || e.State().Buffer.CanUndo() || e.Result().Message != locales.WaitingForJSON() {
		t.Fatal("a canceled transformation restored text after clear")
	}
}

func TestUnmountedTransformFinishesWithoutApplyingOrBlocking(t *testing.T) {
	const source = `{"a":1}`
	e, other := NewJSON(source), NewJSON(`{"other":2}`)
	done := make(chan struct{}, 1)
	e.transform.wake = func() { done <- struct{}{} }
	e.Format()
	awaitWorker(t, done)
	if len(e.transform.results) != 1 || e.State().Buffer.String() != source || other.State().Buffer.String() != `{"other":2}` {
		t.Fatal("an unmounted worker changed document state or could not publish its result")
	}
	// Only the UI consumer can commit the result, preserving one undo step.
	e.refreshTransform(nil)
	if e.Busy() || e.State().Buffer.String() != "{\n  \"a\": 1\n}" {
		t.Fatal("the UI consumer did not apply the completed operation")
	}
	e.State().Buffer.Undo()
	if e.State().Buffer.String() != source || e.State().Buffer.CanUndo() {
		t.Fatal("an asynchronous transform did not remain one undoable edit")
	}
}
