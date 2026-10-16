package json

import (
	"bytes"
	"encoding/json"
)

// Compact removes insignificant whitespace while preserving field order,
// number text, string contents and escapes, including duplicate keys.
func Compact(source string) (string, error) {
	var output bytes.Buffer
	if err := json.Compact(&output, []byte(source)); err != nil {
		return "", syntaxErrorWithLocation(source, err)
	}
	return output.String(), nil
}
