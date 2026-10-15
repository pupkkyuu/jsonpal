// Package jsondoc formats and validates JSON without depending on UI frameworks.
package jsondoc

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

// Diagnostic describes a syntax error using UTF-8 byte offsets in the source.
// Message includes a one-based line and Unicode column for display.
type Diagnostic struct {
	Start, End int
	Message    string
}

// Validate returns the first syntax error, or nil for valid or empty input.
func Validate(source string) []Diagnostic {
	if strings.TrimSpace(source) == "" {
		return nil
	}
	data := []byte(source)
	if json.Valid(data) {
		return nil
	}
	// RawMessage avoids converting numbers to float64 or decoding object fields.
	var document json.RawMessage
	return DiagnosticsForError(source, json.Unmarshal(data, &document))
}

// DiagnosticsForError converts a JSON parser error into a source diagnostic.
// Wrapped encoding/json errors are supported, including formatting errors.
func DiagnosticsForError(source string, err error) []Diagnostic {
	if err == nil {
		return nil
	}
	start := 0
	detail := err.Error()
	var syntax *json.SyntaxError
	if errors.As(err, &syntax) {
		detail = syntax.Error()
		start = min(max(int(syntax.Offset)-1, 0), len(source))
		anchor := source
		lineBreak := start < len(source) && (source[start] == '\n' || source[start] == '\r')
		if lineBreak {
			anchor = source[:start]
		}
		if syntax.Error() == "unexpected end of JSON input" || lineBreak {
			// Anchor missing closing tokens to the last visible character so
			// renderers can underline EOF or an invalid newline in a string.
			start = max(0, len(strings.TrimRight(anchor, " \t\r\n"))-1)
		}
	}
	// Diagnostic ranges must cover whole UTF-8 characters.
	for start > 0 && start < len(source) && !utf8.RuneStart(source[start]) {
		start--
	}
	_, size := utf8.DecodeRuneInString(source[start:])
	end := min(start+size, len(source))
	prefix := source[:start]
	line := strings.Count(prefix, "\n") + 1
	column := utf8.RuneCountInString(prefix[strings.LastIndex(prefix, "\n")+1:]) + 1
	return []Diagnostic{{
		Start: start, End: end,
		Message: fmt.Sprintf("JSON 格式错误：第 %d 行，第 %d 列：%s", line, column, detail),
	}}
}
