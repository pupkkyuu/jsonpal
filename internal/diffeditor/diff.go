// Package diffeditor implements a two-document JSON editor and text diff preview.
// It owns its documents and comparison state independently of workspace tabs.
package diffeditor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/internal/editor"
	"jsonpal/locales"
)

type Diff struct {
	panes            [2]*editor.JSON
	preview          mygoeditor.DiffState
	comparing        bool
	activeSide       int
	requestFocus     bool
	requestSearch    bool
	previewFocus     ui.Handle
	currentHunk      int
	versions         [2]uint64
	result           editor.Result
	transformTask    editor.TransformTask
	transformMessage string
}

var (
	_ editor.Editor                = (*Diff)(nil)
	_ editor.Toolbar               = (*Diff)(nil)
	_ editor.TransformAvailability = (*Diff)(nil)
	_ editor.CopyAvailability      = (*Diff)(nil)
	_ editor.ToolbarShortcuts      = (*Diff)(nil)
)

func New(left, right string) *Diff {
	d := &Diff{panes: [2]*editor.JSON{editor.NewJSON(left), editor.NewJSON(right)}, currentHunk: -1, requestFocus: true}
	d.Left().State().Label, d.Right().State().Label = locales.LeftEditorLabel(), locales.RightEditorLabel()
	d.Left().State().Placeholder, d.Right().State().Placeholder = locales.LeftEditorPlaceholder(), locales.RightEditorPlaceholder()
	d.preview = mygoeditor.DiffState{
		Old: d.Left().State().Buffer, New: d.Right().State().Buffer,
		Layout: mygoeditor.DiffSplit, Inline: mygoeditor.DiffInlineChar,
		ExpandUnchanged: true, TabSize: 2,
		RenderFindBar: editor.FindBar,
	}
	// DiffView has private wrap toggles on each side. Keep preview wrapping
	// controlled by the shared toolbar preference so the sides stay aligned.
	for _, binding := range mygoeditor.DefaultBindings() {
		if binding.Command == mygoeditor.ToggleSoftWrap {
			binding.Command = mygoeditor.NoCommand
			d.preview.Bindings = append(d.preview.Bindings, binding)
		}
	}
	d.rememberVersions()
	return d
}

func (d *Diff) Left() *editor.JSON     { return d.panes[0] }
func (d *Diff) Right() *editor.JSON    { return d.panes[1] }
func (d *Diff) Comparing() bool        { return d.comparing }
func (d *Diff) Busy() bool             { return d.transformTask.Busy() }
func (d *Diff) TransformEnabled() bool { return !d.comparing && !d.Busy() }
func (d *Diff) CopyEnabled() bool      { return false }

func (d *Diff) ToggleComparison() {
	if d.Busy() {
		d.result = editor.Result{Message: locales.ContentModified()}
		d.rememberVersions()
	}
	d.transformTask.Cancel()
	d.comparing = !d.comparing
	d.requestFocus = true
	// Comparing the original buffers does not format, sort or modify them.
	if d.comparing {
		d.currentHunk = -1
	}
}

func (d *Diff) rememberVersions() {
	for i, pane := range d.panes {
		d.versions[i] = pane.State().Buffer.Version()
	}
}

func (d *Diff) refreshResult() {
	for i, pane := range d.panes {
		if d.versions[i] != pane.State().Buffer.Version() {
			d.result = editor.Result{Message: locales.ContentModified()}
			d.currentHunk = -1
			d.rememberVersions()
			return
		}
	}
}

func (d *Diff) Result() editor.Result {
	d.refreshResult()
	return d.result
}

func (d *Diff) View(c *ui.Context, options editor.ViewOptions) {
	d.refreshTransform(c)
	if !options.Shortcuts {
		for _, pane := range d.panes {
			pane.CancelFocus()
		}
		d.requestFocus = false
	}
	d.refreshResult()
	if !d.comparing && options.Shortcuts && c.Shortcut(ui.Cmd|ui.Shift, ui.KeyF) {
		d.Format()
	}
	if d.requestSearch {
		d.panes[d.activeSide].Search()
		d.requestSearch, d.requestFocus = false, false
	}
	focus := options.Focus || d.requestFocus
	focusSide := d.activeSide
	d.requestFocus = false
	if focus {
		for _, pane := range d.panes {
			pane.CancelFocus()
		}
	}
	t := c.Theme()
	ui.Column(c.Key("diff-editor")).Fill().MinWidth(0).Children(func() {
		if d.comparing {
			d.preview.Theme = editor.JSONTheme(t.Dark)
			d.preview.Wrap = d.WrapEnabled()
			view := mygoeditor.DiffView(c.Key("preview"), &d.preview).Fill().
				Focusable().FocusRing(false).Label(locales.DiffPreviewLabel()).Bind(&d.previewFocus)
			if focus {
				view.Focus()
			}
			if options.Shortcuts && view.Shortcut(ui.Cmd, ui.KeyF) {
				d.Search()
				c.Invalidate()
			}
			return
		}
		ui.Row(c.Key("inputs")).Fill().MinWidth(0).Children(func() {
			for i, pane := range d.panes {
				if i > 0 {
					ui.Box(c).Width(1).Shrink(0).FillHeight().Background(t.Border)
				}
				column := ui.Column(c.Key(i)).Grow(1).Basis(0).MinWidth(0).FillHeight()
				column.Children(func() {
					// The parent handles the shared format shortcut once, for both
					// documents. Each pane retains its own native editing shortcuts.
					pane.View(c, editor.ViewOptions{Focus: focus && i == focusSide, Shortcuts: options.Shortcuts, NoAutoFocus: true, OnWrapChanged: d.setWrap})
				})
				if column.FocusWithin() {
					d.activeSide = i
				}
			}
		})
		if focus {
			// Restore after both native views (and any find overlays) are built.
			d.panes[focusSide].Focus()
			d.activeSide = focusSide
		}
	})
}
