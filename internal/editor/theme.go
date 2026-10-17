package editor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
)

type Palette struct {
	text, key, stringValue, number, comment string
}

var vsLight = buildTheme(Palette{
	text:        "#000000",
	key:         "#A31515",
	stringValue: "#0451A5",
	number:      "#098658",
	comment:     "#008000",
})

var vsDark = buildTheme(Palette{
	text:        "#DCDCDC",
	key:         "#9CDCFE",
	stringValue: "#CE9178",
	number:      "#B5CEA8",
	comment:     "#608B4E",
})

func Theme(dark bool) *mygoeditor.Theme {
	if dark {
		return vsDark
	}
	return vsLight
}

func buildTheme(palette Palette) *mygoeditor.Theme {
	// Unspecified colors (background, gutter, selection, etc.) follow Shell.
	t := &mygoeditor.Theme{Text: ui.Hex(palette.text)}
	colors := map[mygoeditor.TokenKind]string{
		mygoeditor.TokenText:     palette.text,
		mygoeditor.TokenProperty: palette.key,
		mygoeditor.TokenString:   palette.stringValue,
		mygoeditor.TokenEscape:   palette.stringValue,
		mygoeditor.TokenNumber:   palette.number,
		// MyGo's JSON tokenizer classifies true, false and null as constants.
		mygoeditor.TokenConstant:    palette.stringValue,
		mygoeditor.TokenKeyword:     palette.stringValue,
		mygoeditor.TokenComment:     palette.comment,
		mygoeditor.TokenOperator:    palette.text,
		mygoeditor.TokenPunctuation: palette.text,
	}
	for kind, hex := range colors {
		t.Tokens[kind].Color = ui.Hex(hex)
	}
	return t
}
