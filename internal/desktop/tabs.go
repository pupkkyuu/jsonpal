package desktop

import (
	"fmt"
	"slices"

	"jsonpal/internal/diffeditor"
	"jsonpal/internal/editor"
	"jsonpal/locales"
)

// workspaceTab holds navigation metadata and an editing surface. Document state
// belongs to the editor, which can represent one or multiple documents.
type workspaceTab struct {
	id     string
	title  string
	editor editor.Editor
}

func newFormatTab(number int, source string) *workspaceTab {
	return &workspaceTab{
		id: fmt.Sprintf("format-%d", number), title: locales.FormatTabTitle(number),
		editor: editor.NewJSON(source),
	}
}

func (app *application) addFormatTab(source string) *workspaceTab {
	app.nextTabNumber++
	tab := newFormatTab(app.nextTabNumber, source)
	app.tabs = append(app.tabs, tab)
	app.activeTab = tab
	app.focusEditor = true
	app.revealTab = tab.id
	return tab
}

func (app *application) addComparisonTab(left, right string) *workspaceTab {
	app.nextComparisonNumber++
	tab := &workspaceTab{
		id:     fmt.Sprintf("comparison-%d", app.nextComparisonNumber),
		title:  locales.ComparisonTabTitle(app.nextComparisonNumber),
		editor: diffeditor.New(left, right),
	}
	app.tabs = append(app.tabs, tab)
	app.activeTab = tab
	app.focusEditor, app.revealTab = true, tab.id
	return tab
}

func (app *application) selectTab(id string) {
	for _, tab := range app.tabs {
		if tab.id == id {
			app.activeTab = tab
			// The destination node may not be built yet; focus it after Bind in view.
			app.focusEditor = true
			app.revealTab = tab.id
			return
		}
	}
}

func (app *application) cycleTab(direction int) {
	if len(app.tabs) < 2 {
		return
	}
	index := slices.Index(app.tabs, app.activeTab)
	if index < 0 {
		app.selectTab(app.tabs[0].id)
		return
	}
	next := (index + direction + len(app.tabs)) % len(app.tabs)
	app.selectTab(app.tabs[next].id)
}

func (app *application) closeTab(id string) {
	for i, tab := range app.tabs {
		if tab.id != id {
			continue
		}
		active := tab == app.activeTab
		app.tabs = slices.Delete(app.tabs, i, i+1)
		if app.revealTab == id {
			app.revealTab = ""
		}
		if len(app.tabs) == 0 {
			app.activeTab = nil
			app.focusEditor = false
		} else if active {
			// Prefer the tab to the right, or the preceding tab at the end.
			app.selectTab(app.tabs[min(i, len(app.tabs)-1)].id)
		}
		return
	}
}
