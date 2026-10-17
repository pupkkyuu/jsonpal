package main

import (
	"jsonpal/internal/app"
	"log"
)

func main() {
	if err := desktop.Run(); err != nil {
		log.Fatal(err)
	}
}
