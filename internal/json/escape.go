package json

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
)

// Escape encodes the entire input as a JSON string, including outer quotes.
// The input may be ordinary text, not just a valid JSON document.
func Escape(source string) (string, error) {
	var output bytes.Buffer
	encoder := json.NewEncoder(&output)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(source); err != nil {
		return "", err
	}
	return strings.TrimSuffix(output.String(), "\n"), nil
}

// Unescape decodes one JSON string layer. Valid non-string JSON stays unchanged;
// otherwise input is also accepted as an escaped string without outer quotes.
// The decoded text need not itself be JSON.
func Unescape(source string) (string, error) {
	input := strings.TrimSpace(source)
	if json.Valid([]byte(input)) {
		if input[0] != '"' {
			return source, nil
		}
		var output string
		err := json.Unmarshal([]byte(input), &output)
		return output, err
	}
	var output string
	if err := json.Unmarshal([]byte(`"`+source+`"`), &output); err != nil {
		// The parser saw an added opening quote; report offsets in the original.
		var syntax *json.SyntaxError
		if errors.As(err, &syntax) {
			original := *syntax
			original.Offset = max(1, min(syntax.Offset-1, int64(len(source))))
			err = &original
		}
		return "", syntaxErrorWithLocation(source, err)
	}
	return output, nil
}
