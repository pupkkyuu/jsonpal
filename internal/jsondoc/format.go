package jsondoc

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"
)

// Format changes whitespace only, preserving field order and number text.
// In particular, it does not round large integers through a float64 value.
func Format(source string) (string, error) {
	var output bytes.Buffer
	if err := json.Indent(&output, []byte(source), "", "  "); err != nil {
		return "", syntaxErrorWithLocation(source, err)
	}
	return strings.TrimSpace(output.String()), nil
}

func syntaxErrorWithLocation(source string, err error) error {
	var syntax *json.SyntaxError
	if errors.As(err, &syntax) {
		// SyntaxError.Offset is a one-based byte offset; count Unicode code
		// points rather than UTF-8 bytes for the displayed column.
		offset := min(max(int(syntax.Offset)-1, 0), len(source))
		prefix := source[:offset]
		line := strings.Count(prefix, "\n") + 1
		column := utf8.RuneCountInString(prefix[strings.LastIndex(prefix, "\n")+1:]) + 1
		return fmt.Errorf("第 %d 行，第 %d 列：%w", line, column, err)
	}
	return err
}
