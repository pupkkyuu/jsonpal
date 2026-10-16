package sidebar

type State struct {
	tabs      []Tab
	activeTab int
}

func newState() *State {
	return &State{}
}
