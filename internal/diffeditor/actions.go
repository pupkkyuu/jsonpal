package diffeditor

import (
	"fmt"
	"strings"

	"jsonpal/internal/editor"
	"jsonpal/internal/jsondoc"
)

func (d *Diff) Format()     { d.transform(jsondoc.Format, "两侧已格式化") }
func (d *Diff) Compact()    { d.transform(jsondoc.Compact, "两侧已压缩") }
func (d *Diff) Escape()     { d.transform(jsondoc.Escape, "两侧已转义") }
func (d *Diff) Unescape()   { d.transform(jsondoc.Unescape, "两侧已去除一层转义") }
func (d *Diff) SortFields() { d.transform(jsondoc.SortFields, "两侧已按字段排序") }

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
			d.result = editor.Result{Message: fmt.Sprintf("%s：%s", []string{"左侧", "右侧"}[i], err), HasError: true}
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
	d.result = editor.Result{Message: "已复制两侧内容"}
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
	d.result = editor.Result{Message: "等待输入两侧 JSON"}
	d.rememberVersions()
	d.requestFocus = true
}
