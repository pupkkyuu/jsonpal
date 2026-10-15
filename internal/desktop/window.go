package desktop

import (
	"github.com/egoist/mygo"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

// Run initializes the native window and runs the desktop application's event loop.
func Run() error {
	app := newApplication()
	mygo.App.WhenReady(func() { app.shell = sidebar.NewShell(app.shellOptions()) })
	return mygo.App.Run()
}
