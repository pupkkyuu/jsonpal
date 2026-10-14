package main

import (
	"log"

	"github.com/egoist/mygo"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

func main() {
	app := newApplication()
	mygo.App.WhenReady(func() {
		sidebar.NewShell(app.shellOptions())
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
