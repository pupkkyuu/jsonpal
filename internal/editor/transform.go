package editor

import (
	"strings"
	"time"

	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/jsondoc"
)

// PreparedTransform contains immutable worker output for one document version.
// Text, comparisons and diagnostics are all prepared away from the UI thread.
type PreparedTransform struct {
	Version     uint64
	Text        string
	Changed     bool
	Empty       bool
	HasError    bool
	Diagnostics []jsondoc.Diagnostic
}

// TransformTask runs at most one single- or multi-document operation at a time.
// Its methods belong to the UI thread; workers only capture snapshots, their
// result channel and the thread-safe wake callback. An unmounted editor can
// finish without blocking, and consumes its result when mounted again.
type TransformTask struct {
	results  chan []PreparedTransform
	wake     func()
	canceled bool
	poll     bool
}

func (task *TransformTask) Busy() bool { return task.results != nil }

// Cancel discards the pending result without starting overlapping workers.
func (task *TransformTask) Cancel() { task.canceled = true }

func (task *TransformTask) Start(snapshots []mygoeditor.Snapshot, transform func(string) (string, error), skipEmpty bool) bool {
	if task.Busy() {
		return false
	}
	results := make(chan []PreparedTransform, 1)
	task.results, task.canceled = results, false
	wake := task.wake
	task.poll = wake == nil
	go func() {
		prepared := make([]PreparedTransform, len(snapshots))
		for i, snapshot := range snapshots {
			prepared[i].Version = snapshot.Version()
		}
		for i, snapshot := range snapshots {
			source := snapshot.String()
			result := PreparedTransform{Version: snapshot.Version(), Text: source}
			if skipEmpty && strings.TrimSpace(source) == "" {
				result.Empty = true
			} else if text, err := transform(source); err != nil {
				result.HasError = true
				result.Diagnostics = jsondoc.DiagnosticsForError(source, err)
			} else {
				result.Text, result.Changed = text, text != source
				// Unescape can produce ordinary text. Diagnose every result here
				// so committing it never revalidates the whole document on UI.
				result.Diagnostics = jsondoc.Validate(text)
			}
			prepared[i] = result
			if result.HasError {
				break // A pair must never be partially committed.
			}
		}
		results <- prepared
		if wake != nil {
			wake()
		}
	}()
	return true
}

// Update polls without waiting. A short fallback timer also covers operations
// started before the editor's first View, when no wake service was bound yet.
func (task *TransformTask) Update(c *ui.Context) ([]PreparedTransform, bool) {
	if c != nil {
		task.wake = c.Services().Invalidate
	}
	if !task.Busy() {
		return nil, false
	}
	select {
	case result := <-task.results:
		task.results = nil
		if c != nil {
			c.Invalidate()
		}
		if task.canceled {
			return nil, true
		}
		return result, true
	default:
		if c != nil && task.poll {
			c.After(16 * time.Millisecond)
		}
		return nil, false
	}
}
