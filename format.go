package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

// formatJSON changes whitespace only, preserving field order and number text.
// In particular, it does not round large integers through a float64 value.
func formatJSON(source string) (string, error) {
	var output bytes.Buffer
	if err := json.Indent(&output, []byte(source), "", "  "); err != nil {
		var syntax *json.SyntaxError
		if errors.As(err, &syntax) {
			// SyntaxError.Offset is a one-based byte offset; show a human-readable
			// column by counting Unicode code points rather than UTF-8 bytes.
			offset := min(max(int(syntax.Offset)-1, 0), len(source))
			prefix := source[:offset]
			line := strings.Count(prefix, "\n") + 1
			column := utf8.RuneCountInString(prefix[strings.LastIndex(prefix, "\n")+1:]) + 1
			return "", fmt.Errorf("第 %d 行，第 %d 列：%w", line, column, err)
		}
		return "", err
	}
	return strings.TrimSpace(output.String()), nil
}
