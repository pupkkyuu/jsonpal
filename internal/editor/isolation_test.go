package editor

import (
	"testing"
	"time"
)

func TestValidationResultsStayWithTheirEditor(t *testing.T) {
	first := NewJSON("")
	first.code.Buffer.Set(`{"first":]}`)
	done := make(chan struct{}, 1)
	wake := func() { done <- struct{}{} }
	now := time.Unix(1, 0)
	first.refreshJSONDiagnostics(now, wake)
	first.refreshJSONDiagnostics(now.Add(jsonValidationDelay), wake)
	awaitJSONValidation(t, done)
	second := NewJSON("")
	second.code.Buffer.Set(`{"second":true}`)
	if first.code.Buffer.Version() != second.code.Buffer.Version() {
		t.Fatal("fixture needs equal document versions")
	}
	second.refreshJSONDiagnostics(now, wake)
	if len(second.code.Diagnostics()) != 0 {
		t.Fatal("a background result from another editor was applied")
	}
	first.refreshJSONDiagnostics(now.Add(jsonValidationDelay), wake)
	if len(first.code.Diagnostics()) != 1 || len(second.code.Diagnostics()) != 0 {
		t.Fatal("completed validation affected another editor")
	}
	second.refreshJSONDiagnostics(now.Add(jsonValidationDelay), wake)
	awaitJSONValidation(t, done)
	second.refreshJSONDiagnostics(now.Add(jsonValidationDelay), wake)
	if len(second.code.Diagnostics()) != 0 {
		t.Fatal("valid second document kept the first document's error")
	}
}
