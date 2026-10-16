package json

import (
	"encoding/json"
	"slices"
	"strings"
	"unicode/utf16"
)

// SortFields recursively sorts object keys and emits two-space JSON. Arrays
// retain their order. Raw tokens preserve numbers, escapes and duplicate keys.
// Keys use UTF-16 lexical order, matching JavaScript string comparison.
func SortFields(source string) (string, error) {
	compact, err := Compact(source)
	if err != nil {
		return "", err
	}
	parser := sortParser{source: compact}
	node := parser.readValue()
	var output strings.Builder
	output.Grow(len(compact))
	node.write(&output)
	return Format(output.String())
}

type sortedField struct {
	key   string
	order []uint16
	value sortedValue
}

type sortedValue struct {
	kind   byte
	raw    string
	fields []sortedField
	items  []sortedValue
}

// Input has already been validated and compacted by encoding/json. This parser
// only records token slices and container structure; it never decodes numbers.
type sortParser struct {
	source string
	pos    int
}

func (p *sortParser) readString() string {
	start := p.pos
	p.pos++
	for p.source[p.pos] != '"' {
		if p.source[p.pos] == '\\' {
			p.pos++
		}
		p.pos++
	}
	p.pos++
	return p.source[start:p.pos]
}

func (p *sortParser) readValue() sortedValue {
	v := sortedValue{kind: p.source[p.pos]}
	switch v.kind {
	case '{':
		p.pos++
		for p.source[p.pos] != '}' {
			key := p.readString()
			var decoded string
			// readString returns a validated JSON string token.
			_ = json.Unmarshal([]byte(key), &decoded)
			p.pos++ // colon
			v.fields = append(v.fields, sortedField{key: key, order: utf16.Encode([]rune(decoded)), value: p.readValue()})
			if p.source[p.pos] == ',' {
				p.pos++
			}
		}
		p.pos++
		slices.SortStableFunc(v.fields, func(a, b sortedField) int { return slices.Compare(a.order, b.order) })
	case '[':
		p.pos++
		for p.source[p.pos] != ']' {
			v.items = append(v.items, p.readValue())
			if p.source[p.pos] == ',' {
				p.pos++
			}
		}
		p.pos++
	case '"':
		v.raw = p.readString()
	default:
		start := p.pos
		for p.pos < len(p.source) && !strings.ContainsRune(",]}", rune(p.source[p.pos])) {
			p.pos++
		}
		v.raw = p.source[start:p.pos]
	}
	return v
}

func (v sortedValue) write(output *strings.Builder) {
	switch v.kind {
	case '{':
		output.WriteByte('{')
		for i, field := range v.fields {
			if i > 0 {
				output.WriteByte(',')
			}
			output.WriteString(field.key)
			output.WriteByte(':')
			field.value.write(output)
		}
		output.WriteByte('}')
	case '[':
		output.WriteByte('[')
		for i, item := range v.items {
			if i > 0 {
				output.WriteByte(',')
			}
			item.write(output)
		}
		output.WriteByte(']')
	default:
		output.WriteString(v.raw)
	}
}
