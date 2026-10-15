package jsondoc

import "testing"

func TestSortFieldsPreservesData(t *testing.T) {
	for _, test := range []struct{ name, source, want string }{
		{"recursive with arrays", `{"z":[{"b":2,"a":1},3,2],"a":{"z":false,"a":null}}`, `{"a":{"a":null,"z":false},"z":[{"a":1,"b":2},3,2]}`},
		{"number precision", `{"z":900719925474099312345,"c":1e-1000,"b":-0,"a":1.2300}`, `{"a":1.2300,"b":-0,"c":1e-1000,"z":900719925474099312345}`},
		{"duplicate keys and escapes", `{"z":"\u4e2d","\u0061":1,"a":2,"empty":{},"array":[]}`, `{"\u0061":1,"a":2,"array":[],"empty":{},"z":"\u4e2d"}`},
		{"UTF16 lexical order", `{"\ue000":1,"😀":2,"Z":3,"a":4}`, `{"Z":3,"a":4,"😀":2,"\ue000":1}`},
		{"lexical numbers", `{"2":2,"10":10,"1":1}`, `{"1":1,"10":10,"2":2}`},
		{"string with escaped quotes", `{"z":"[,]\"\\","a":"中文"}`, `{"a":"中文","z":"[,]\"\\"}`},
		{"scalar", " \n true \n", `true`},
	} {
		t.Run(test.name, func(t *testing.T) {
			want, err := Format(test.want)
			if err != nil {
				t.Fatal(err)
			}
			got, err := SortFields(test.source)
			if err != nil || got != want {
				t.Fatalf("SortFields() = %q, %v; want %q", got, err, want)
			}
			if again, err := SortFields(got); err != nil || again != got {
				t.Fatal("sorting is not idempotent")
			}
		})
	}
	for _, source := range []string{"", `{"a":}`, `{} {}`, `// comment`, `[1,]`} {
		if got, err := SortFields(source); err == nil || got != "" {
			t.Errorf("SortFields(%q) = %q, %v; want failure", source, got, err)
		}
	}
}
