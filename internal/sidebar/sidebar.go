package sidebar

import (
	"github.com/egoist/mygo/ui"
)

type Sidebar struct {
	state              *State
	view               *View
	OnNewFormatClicked func()
	OnSettingsClicked  func()
}

func NewSidebar() *Sidebar {
	sidebar := &Sidebar{
		state: newState(),
		view:  NewView(),
	}

	sidebar.view.onNewFormatClicked = func() {
		if sidebar.OnNewFormatClicked != nil {
			sidebar.OnNewFormatClicked()
		}
	}
	sidebar.view.onSettingsClicked = func() {
		if sidebar.OnSettingsClicked != nil {
			sidebar.OnSettingsClicked()
		}
	}

	return sidebar
}

func (s *Sidebar) View(c *ui.Context) {
	s.view.Render(c, s.state)
}

func (s *Sidebar) FooterView(c *ui.Context) {
	s.view.renderFooter(c)
}

func (s *Sidebar) SetTabs(tabs []Tab, activeId int) {
	s.state.tabs = tabs
	s.state.activeTab = activeId
}
