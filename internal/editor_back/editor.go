// Package editor owns document editing, rendering and JSON diagnostics.
// Editors are independent of workspace tabs and native window composition.
package editor

import "github.com/egoist/mygo/ui"

// Editor is the workspace's editing surface. Implementations own their document
// states; implementations may own one or multiple documents.
type Editor interface {
	View(c *ui.Context, options ViewOptions)
	Format()
	Compact()
	FoldAll()
	UnfoldAll()
	ToggleWrap()
	WrapEnabled() bool
	Escape()
	Unescape()
	CopyAll(writeClipboard func(string))
	SortFields()
	Search()
	Clear()
	Result() Result
}

// Toolbar adds controls specific to an editor type to the workspace toolbar.
type Toolbar interface {
	Toolbar(c *ui.Context)
}

// BackgroundWork exposes pending operations without exposing document state.
type BackgroundWork interface {
	Busy() bool
}

// TransformAvailability disables transforms during work or in preview mode.
type TransformAvailability interface {
	TransformEnabled() bool
}

// CopyAvailability lets an editor disable the toolbar's full-document copy.
type CopyAvailability interface {
	CopyEnabled() bool
}

// ViewOptions lets the host request focus and suspend application shortcuts
// while a modal is open, without owning the editor's focus handle or state.
type ViewOptions struct {
	Focus     bool
	Shortcuts bool
	// NoAutoFocus lets a multi-pane host choose which document receives focus.
	NoAutoFocus bool
	// OnWrapChanged lets a multi-document editor keep its panes in sync when
	// one of them handles the native wrapping shortcut.
	OnWrapChanged func(bool)
}

// Result describes the latest explicit document action. Live syntax errors are
// shown separately through the native editor's diagnostics.
type Result struct {
	Message  string
	HasError bool
}
