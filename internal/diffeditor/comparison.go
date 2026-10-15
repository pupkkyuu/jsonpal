package diffeditor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"

	"jsonpal/locales"
)

func (d *Diff) Hunks() []mygoeditor.DiffHunk { return d.preview.Hunks() }

func (d *Diff) ToolbarShortcut(action string) string {
	if action == "search" {
		return "⌘F"
	}
	if !d.comparing && (action == "format" || action == "wrap") {
		return d.Left().ToolbarShortcut(action)
	}
	return ""
}

func (d *Diff) NextDifference()     { d.goDifference(1) }
func (d *Diff) PreviousDifference() { d.goDifference(-1) }

func (d *Diff) goDifference(direction int) {
	if !d.comparing {
		return
	}
	hunks := d.Hunks()
	if len(hunks) == 0 {
		d.currentHunk = -1
		return
	}
	if d.currentHunk < 0 {
		if direction > 0 {
			d.currentHunk = 0
		} else {
			d.currentHunk = len(hunks) - 1
		}
	} else {
		d.currentHunk = (d.currentHunk + direction + len(hunks)) % len(hunks)
	}
	d.preview.GoToHunk(d.currentHunk)
	d.previewFocus.Focus()
}

func (d *Diff) Toolbar(c *ui.Context) {
	if d.comparing {
		count := len(d.Hunks())
		if sidebar.IconButton(c.Key("previous-difference"), lucide.ArrowUp(), locales.PreviousDifference()).Disabled(count == 0).KeepFocus().Clicked() {
			d.PreviousDifference()
		}
		if sidebar.IconButton(c.Key("next-difference"), lucide.ArrowDown(), locales.NextDifference()).Disabled(count == 0).KeepFocus().Clicked() {
			d.NextDifference()
		}
	}
	label, icon := locales.CompareJSON(), lucide.FileDiff()
	if d.comparing {
		label, icon = locales.EditJSON(), lucide.Pencil()
	}
	if sidebar.IconButton(c.Key("comparison-toggle"), icon, label).KeepFocus().Clicked() {
		d.ToggleComparison()
		c.Invalidate()
	}
}
