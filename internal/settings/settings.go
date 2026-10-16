package settings

import (
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

type Settings struct {
	state   *State
	view    *View
	OnClose func()
}

func NewSetting() *Settings {
	setting := &Settings{
		state: NewState(),
		view:  NewView(),
	}
	setting.view.OnAppearanceChanged = mygo.Theme.SetSource
	setting.view.OnClose = func() {
		if setting.OnClose != nil {
			setting.OnClose()
		}
	}

	return setting
}

func (s *Settings) View(c *ui.Context, isOpen bool) {
	if !isOpen {
		return
	}
	open := &isOpen
	s.view.Render(c, s.state, open)
	if !isOpen && s.OnClose != nil {
		s.OnClose()
	}
}
