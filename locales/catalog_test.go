package locales_test

import (
	"slices"
	"testing"

	"github.com/egoist/mygo"
	"jsonpal/locales"
)

func TestChineseOnlyCatalogFallsBackForEnglish(t *testing.T) {
	if got := mygo.App.Languages(); !slices.Equal(got, []string{"zh-Hans"}) {
		t.Fatalf("shipped languages = %v; want only zh-Hans", got)
	}
	for _, tag := range []string{"zh-Hans", "zh-CN", "en", "en-US"} {
		messages := locales.In(tag)
		if messages.FindQuery() != "查找" || messages.FormatTabTitle(1234) != "格式化 1234" {
			t.Fatalf("unexpected fallback or grouped document number for %s", tag)
		}
		if messages.JsonErrorLocation(1234, 5678, "parser detail") != "JSON 格式错误：第 1234 行，第 5678 列：parser detail" {
			t.Fatalf("diagnostic position or parser detail changed for %s", tag)
		}
	}
}
