package diffeditor

import (
	"strings"

	"jsonpal/internal/editor"
	"jsonpal/internal/jsondoc"
	"jsonpal/locales"
)

func (d *Diff) Format()     { d.transform(jsondoc.Format, locales.DiffFormatSuccess()) }
func (d *Diff) Compact()    { d.transform(jsondoc.Compact, locales.DiffCompactSuccess()) }
func (d *Diff) Escape()     { d.transform(jsondoc.Escape, locales.DiffEscapeSuccess()) }
func (d *Diff) Unescape()   { d.transform(jsondoc.Unescape, locales.DiffUnescapeSuccess()) }
func (d *Diff) SortFields() { d.transform(jsondoc.SortFields, locales.DiffSortSuccess()) }

// Calculate both results first so a failure never partially updates a pair.
func (d *Diff) transform(transform func(string) (string, error), message string) {
	if d.comparing {
		return
	}
	var results [2]string
	for i, pane := range d.panes {
		source := pane.State().Buffer.String()
		results[i] = source
		if strings.TrimSpace(source) == "" {
			continue
		}
		result, err := transform(source)
		if err != nil {
			pane.ReportError(err)
			message := locales.DiffLeftError(pane.Result().Message)
			if i == 1 {
				message = locales.DiffRightError(pane.Result().Message)
			}
			d.result = editor.Result{Message: message, HasError: true}
			d.rememberVersions()
			d.activeSide, d.requestFocus = i, true
			return
		}
		results[i] = result
	}
	for i, pane := range d.panes {
		pane.ApplyText(results[i], message)
	}
	d.result = editor.Result{Message: message}
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
	for _, pane := range d.panes {
		pane.Clear()
	}
	d.comparing, d.activeSide, d.currentHunk = false, 0, -1
	d.result = editor.Result{Message: locales.DiffWaiting()}
	d.rememberVersions()
	d.requestFocus = true
}
