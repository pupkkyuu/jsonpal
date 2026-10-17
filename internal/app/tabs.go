package desktop

// workspaceTab holds navigation metadata and an editing surface. Document state
// belongs to the editor, which can represent one or multiple documents.
//type workspaceTab struct {
//	id     string
//	title  string
//	editor editor.Editor
//}

//func (app *Application) addFormatTab(source string) *workspaceTab {
//	app.next++
//	tab := newFormatTab(app.next, source)
//	//app.tabs = append(app.tabs, tab)
//	//app.activeTab = tab
//	app.focusEditor = true
//	app.revealTab = tab.id
//	return tab
//}

func (app *Application) addComparisonTab(left, right string) {
	app.nextComparisonNumber++
	//tab := &workspaceTab{
	//	id:     fmt.Sprintf("comparison-%d", app.nextComparisonNumber),
	//	title:  locales.ComparisonTabTitle(app.nextComparisonNumber),
	//	editor: diffeditor.New(left, right),
	//}
	////app.tabs = append(app.tabs, tab)
	////app.activeTab = tab
	//app.focusEditor, app.revealTab = true, tab.id
	//return tab
}

func (app *Application) selectTab(id string) {
	//for _, tab := range app.tabs {
	//	if tab.id == id {
	//		app.activeTab = tab
	//		// The destination node may not be built yet; focus it after Bind in view.
	//		app.focusEditor = true
	//		app.revealTab = tab.id
	//		return
	//	}
	//}
}

func (app *Application) cycleTab(direction int) {
	//if len(app.tabs) < 2 {
	//	return
	//}
	//index := slices.Index(app.tabs, app.activeTab)
	//if index < 0 {
	//	app.selectTab(app.tabs[0].id)
	//	return
	//}
	//next := (index + direction + len(app.tabs)) % len(app.tabs)
	//app.selectTab(app.tabs[next].id)
}

func (app *Application) closeTab(id string) {
	//for i, tab := range app.tabs {
	//	if tab.id != id {
	//		continue
	//	}
	//	active := tab == app.activeTab
	//	app.tabs = slices.Delete(app.tabs, i, i+1)
	//	if app.revealTab == id {
	//		app.revealTab = ""
	//	}
	//	if len(app.tabs) == 0 {
	//		app.activeTab = nil
	//		app.focusEditor = false
	//	} else if active {
	//		// Prefer the tab to the right, or the preceding tab at the end.
	//		app.selectTab(app.tabs[min(i, len(app.tabs)-1)].id)
	//	}
	//	return
	//}
}
