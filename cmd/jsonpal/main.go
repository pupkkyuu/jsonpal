package main

import (
	"jsonpal/internal/desktop"
	"log"
)

func main() {
	if err := desktop.Run(); err != nil {
		log.Fatal(err)
	}
}
