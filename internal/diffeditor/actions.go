package diffeditor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/editor_back"
	"jsonpal/internal/json"
	"jsonpal/locales"
)

func (d *Diff) Format()     { d.transform(json.Format, locales.DiffFormatSuccess()) }
func (d *Diff) Compact()    { d.transform(json.Compact, locales.DiffCompactSuccess()) }
func (d *Diff) Escape()     { d.transform(json.Escape, locales.DiffEscapeSuccess()) }
func (d *Diff) Unescape()   { d.transform(json.Unescape, locales.DiffUnescapeSuccess()) }
func (d *Diff) SortFields() { d.transform(json.SortFields, locales.DiffSortSuccess()) }

// Calculate both results off the UI thread before committing either document.
func (d *Diff) transform(transform func(string) (string, error), message string) {
	if !d.TransformEnabled() {
		return
	}
	var snapshots []mygoeditor.Snapshot
	for _, pane := range d.panes {
		snapshots = append(snapshots, pane.State().Buffer.Snapshot())
	}
	if d.transformTask.Start(snapshots, transform, true) {
		d.transformMessage = message
		d.result = editor.Result{Message: locales.Processing()}
		d.rememberVersions()
	}
}

func (d *Diff) refreshTransform(c *ui.Context) {
	results, ready := d.transformTask.Update(c)
	if !ready || len(results) == 0 {
		return
	}
	// Editing either side invalidates the entire pair, even an error result.
	for i, pane := range d.panes {
		if pane.State().Buffer.Version() != results[i].Version {
			return
		}
	}
	for i, pane := range d.panes {
		if results[i].HasError {
			pane.ApplyPreparedTransform(results[i], "")
			message := locales.DiffLeftError(pane.Result().Message)
			if i == 1 {
				message = locales.DiffRightError(pane.Result().Message)
			}
			d.result = editor.Result{Message: message, HasError: true}
			d.rememberVersions()
			d.activeSide, d.requestFocus = i, true
			return
		}
	}
	for i, pane := range d.panes {
		pane.ApplyPreparedTransform(results[i], d.transformMessage)
	}
	d.result = editor.Result{Message: d.transformMessage}
	d.rememberVersions()
	d.requestFocus = true
}

func (d *Diff) FoldAll() {
	if d.comparing {
		d.preview.CollapseAll()
	} else {
		for _, pane := range d.panes {
			pane.FoldAll()
		}
	}
	d.requestFocus = true
}

func (d *Diff) UnfoldAll() {
	if d.comparing {
		d.preview.ExpandAll()
	} else {
		for _, pane := range d.panes {
			pane.UnfoldAll()
		}
	}
	d.requestFocus = true
}

func (d *Diff) WrapEnabled() bool { return d.Left().WrapEnabled() }

func (d *Diff) ToggleWrap() {
	d.setWrap(!d.WrapEnabled())
}

func (d *Diff) setWrap(enabled bool) {
	for _, pane := range d.panes {
		pane.State().SoftWrap = enabled
	}
	d.preview.Wrap = enabled
}

func (d *Diff) CopyAll(writeClipboard func(string)) {
	writeClipboard(d.Left().State().Buffer.String() + "\n" + d.Right().State().Buffer.String())
	d.result = editor.Result{Message: locales.DiffCopySuccess()}
	d.rememberVersions()
}

func (d *Diff) Search() {
	// Search the actual editable document with its retained native find state.
	d.comparing = false
	d.requestSearch = true
}

func (d *Diff) Clear() {
	d.transformTask.Cancel()
	for _, pane := range d.panes {
		pane.Clear()
	}
	d.comparing, d.activeSide, d.currentHunk = false, 0, -1
	d.result = editor.Result{Message: locales.DiffWaiting()}
	d.rememberVersions()
	d.requestFocus = true
}
