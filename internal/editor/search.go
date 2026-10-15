package editor

import mygoeditor "github.com/egoist/mygo/ui/editor"

// Search opens the native find bar and focuses its query, using the selection
// or word at the caret just as the editor's find shortcut does.
func (e *JSON) Search() {
	e.code.Run(mygoeditor.Find)
}
