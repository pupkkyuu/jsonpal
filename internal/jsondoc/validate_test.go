package jsondoc

import (
	"fmt"
	"testing"
)

func TestJSONDiagnosticLocations(t *testing.T) {
	for _, test := range []struct{ source, marked, location string }{
		{"{\n  \"a\": ]\n}", "]", "第 2 行，第 8 列"},
		{`{"中文😀":]}`, "]", "第 1 行，第 8 列"},
		{`{"a":1 "b":2}`, `"`, "第 1 行，第 8 列"},
		{`{"a":"😀`, "😀", "第 1 行，第 7 列"},
		{"{\"a\":\"😀 \n", "😀", "第 1 行，第 7 列"},
		{"{\"a\":1 \n", "1", "第 1 行，第 6 列"},
		{`{} []`, "[", "第 1 行，第 4 列"},
		{`// comment`, "/", "第 1 行，第 1 列"},
	} {
		t.Run(test.source, func(t *testing.T) {
			diagnostics := Validate(test.source)
			if len(diagnostics) != 1 {
				t.Fatalf("diagnostics = %v", diagnostics)
			}
			d := diagnostics[0]
			if got := test.source[d.Start:d.End]; got != test.marked || fmt.Sprintf("第 %d 行，第 %d 列", d.Line, d.Column) != test.location {
				t.Fatalf("unexpected diagnostic: %+v (marked %q)", d, got)
			}
		})
	}
	for _, source := range []string{"", " \n\t", `{"id":900719925474099312345,"tiny":1e-1000,"value":null}`, `[]`} {
		if ds := Validate(source); len(ds) != 0 {
			t.Errorf("valid input %q has diagnostics: %v", source, ds)
		}
	}
}
