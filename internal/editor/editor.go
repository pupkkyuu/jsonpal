package editor

import "github.com/egoist/mygo/ui"

type Editor interface {
	Id() int
	Title() string
	View(c *ui.Context)
	Format()
}

type Options struct {
	Focus         bool
	Shortcuts     bool
	NoAutoFocus   bool
	OnWrapChanged func(bool)
}
