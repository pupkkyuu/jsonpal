package main

import (
	"strings"
	"testing"
)

func TestFormatJSON(t *testing.T) {
	tests := []struct {
		name, source, want string
	}{
		{"nested", ` {"z":[1,{"a":true}],"a":null} `, "{\n  \"z\": [\n    1,\n    {\n      \"a\": true\n    }\n  ],\n  \"a\": null\n}"},
		{"number precision and spelling", `{"id":900719925474099312345,"price":1.2300,"tiny":1e-1000}`, "{\n  \"id\": 900719925474099312345,\n  \"price\": 1.2300,\n  \"tiny\": 1e-1000\n}"},
		{"escaped and unicode text", `{"text":"中文😀","escaped":"\u4e2d\n"}`, "{\n  \"text\": \"中文😀\",\n  \"escaped\": \"\\u4e2d\\n\"\n}"},
		{"duplicate keys preserved", `{"a":1,"a":2}`, "{\n  \"a\": 1,\n  \"a\": 2\n}"},
		{"primitive", " \n true \n", "true"},
		{"array", `[1,2]`, "[\n  1,\n  2\n]"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := formatJSON(test.source)
			if err != nil || got != test.want {
				t.Fatalf("formatJSON() = %q, %v; want %q", got, err, test.want)
			}
			again, err := formatJSON(got)
			if err != nil || again != got {
				t.Fatalf("formatting is not idempotent: %q, %v", again, err)
			}
		})
	}
}

func TestFormatJSONRejectsInvalidInput(t *testing.T) {
	for _, source := range []string{"", " ", `{"a":}`, `{"a":1,}`, `{} {}`, `// comment`, `{"x":NaN}`} {
		if got, err := formatJSON(source); err == nil || got != "" {
			t.Errorf("formatJSON(%q) = %q, %v; want failure", source, got, err)
		}
	}
}

func TestFormatJSONErrorLocation(t *testing.T) {
	for _, test := range []struct{ source, location string }{
		{"{\n  \"a\": ]\n}", "第 2 行，第 8 列"},
		{`{"中文":]}`, "第 1 行，第 7 列"},
		{`{"emoji😀":]}`, "第 1 行，第 11 列"},
	} {
		_, err := formatJSON(test.source)
		if err == nil || !strings.Contains(err.Error(), test.location) {
			t.Errorf("error for %q = %v; want %s", test.source, err, test.location)
		}
	}
}
