package settings

import (
	"github.com/oneo-me/onevra/source/components"
)

type State struct {
	components.SettingsState // Category-选择哪个分类,Query-设置里的搜索框
}

func NewState() *State {
	return &State{}
}
