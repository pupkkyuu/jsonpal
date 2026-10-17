package editor

import mygoeditor "github.com/egoist/mygo/ui/editor"

// FoldAll collapses all foldable regions, including nested objects and arrays.
// Folding changes the view only and does not create a document undo step.
func (e *JSON) FoldAll() {
	e.code.Run(mygoeditor.FoldAll)
	e.focus.Focus()
}

// UnfoldAll reveals every folded region in this editor.
func (e *JSON) UnfoldAll() {
	e.code.Run(mygoeditor.UnfoldAll)
	e.focus.Focus()
}
