package jsondoc

import "testing"

func TestEscapeAndUnescapeRoundTrip(t *testing.T) {
	for _, source := range []string{"", " \n \t", `{"b":1,"a":2}`, "中文😀\n\t\"\\", `<>&`, `ordinary text`, `"already escaped"`} {
		escaped, err := Escape(source)
		if err != nil {
			t.Fatal(err)
		}
		decoded, err := Unescape(escaped)
		if err != nil || decoded != source {
			t.Fatalf("round trip for %q = %q, %v", source, decoded, err)
		}
	}
	if got, _ := Escape(`<>&`); got != `"<>&"` {
		t.Fatal("escaping unexpectedly rewrote HTML characters")
	}
}

func TestUnescapeOneLayerAndUnquotedInput(t *testing.T) {
	for _, test := range []struct{ source, want string }{
		{`{\"a\":1}`, `{"a":1}`},
		{`hello\nworld`, "hello\nworld"},
		{`"\"hello\""`, `"hello"`},
		{`"\u4e2d\ud83d\ude00"`, "中😀"},
		{` {"a":1} `, ` {"a":1} `},
		{`[1,2]`, `[1,2]`},
		{`12345678901234567890`, `12345678901234567890`},
		{`true`, `true`},
		{`null`, `null`},
	} {
		if got, err := Unescape(test.source); err != nil || got != test.want {
			t.Errorf("Unescape(%q) = %q, %v; want %q", test.source, got, err, test.want)
		}
	}
	for _, source := range []string{`bad\q`, `trailing\`, `"unterminated`, "raw\nnewline"} {
		if got, err := Unescape(source); err == nil || got != "" {
			t.Errorf("Unescape(%q) = %q, %v; want failure", source, got, err)
		}
	}
}
