package editor

// ToolbarShortcuts supplies hints only when a shortcut performs the same
// action as the toolbar button in the editor's current mode.
type ToolbarShortcuts interface {
	ToolbarShortcut(action string) string
}

func (e *JSON) ToolbarShortcut(action string) string {
	switch action {
	case "format":
		return "⌘⇧F"
	case "collapse":
		return "⌘K → ⌘0"
	case "expand":
		return "⌘K → ⌘J"
	case "wrap":
		return "⌘K → Z"
	case "search":
		return "⌘F"
	default:
		return ""
	}
}
