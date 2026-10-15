package jsondoc

import (
	"strings"
	"testing"
)

func TestCompactPreservesDocumentData(t *testing.T) {
	for _, test := range []struct{ name, source, want string }{
		{"nested", " \n {\"z\": [1, {\"a\": true}], \"a\": null} \t", `{"z":[1,{"a":true}],"a":null}`},
		{"number spelling", ` { "id": 900719925474099312345, "price": 1.2300, "tiny": 1e-1000, "zero": -0 } `, `{"id":900719925474099312345,"price":1.2300,"tiny":1e-1000,"zero":-0}`},
		{"string whitespace and escapes", ` { "text": "中文 😀  a b", "escaped": "\u4e2d\n\t\" \\" } `, `{"text":"中文 😀  a b","escaped":"\u4e2d\n\t\" \\"}`},
		{"duplicate keys", ` { "a": 1, "a": 2 } `, `{"a":1,"a":2}`},
		{"primitive", " \n true \n", "true"},
		{"string primitive", ` " a b " `, `" a b "`},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := Compact(test.source)
			if err != nil || got != test.want {
				t.Fatalf("Compact() = %q, %v; want %q", got, err, test.want)
			}
			formatted, err := Format(got)
			if err != nil {
				t.Fatal(err)
			}
			if again, err := Compact(formatted); err != nil || again != got {
				t.Fatalf("format/compact round trip = %q, %v; want %q", again, err, got)
			}
		})
	}
}

func TestCompactRejectsInvalidInput(t *testing.T) {
	for _, source := range []string{"", " \n ", `{"a":}`, `{"a":1,}`, `{} {}`, `// comment`, `{"x":NaN}`} {
		if got, err := Compact(source); err == nil || got != "" {
			t.Errorf("Compact(%q) = %q, %v; want failure", source, got, err)
		}
	}
	_, err := Compact("{\n  \"中文😀\": ]\n}")
	if err == nil || !strings.Contains(err.Error(), "第 2 行，第 10 列") {
		t.Fatalf("wrong Unicode error location: %v", err)
	}
}
