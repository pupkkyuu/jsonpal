package editor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"
)

// WrapEnabled is the authoritative per-editor wrapping preference.
func (e *JSON) WrapEnabled() bool { return e.code.SoftWrap }

// ToggleWrap changes view configuration without editing text or selection.
func (e *JSON) ToggleWrap() {
	e.code.SoftWrap = !e.code.SoftWrap
	e.focus.Focus()
}

// MyGo's ToggleSoftWrap command uses a private toggle with no public getter.
// Route its shortcut through our preference instead, including the shared
// Cmd+K prefix. Other commands on that prefix keep their native behavior.
func (e *JSON) wrapShortcuts(view ui.Element, enabled bool) {
	if !enabled || !view.Focused() {
		e.wrapChord = nil
		return
	}
	bindings := append(append([]mygoeditor.Binding(nil), e.code.Bindings...), mygoeditor.DefaultBindings()...)
	if prefix := e.wrapChord; prefix != nil {
		// A chord consumes its next key even when unbound, as MyGo does. Register
		// these temporarily so ordinary typing and undo retain their usual meaning
		// outside the chord, and an unbound key cancels rather than staying pending.
		for key := ui.KeyEnter; key <= ui.KeyForward; key++ {
			for mods := ui.Modifiers(0); mods <= ui.Shift|ui.Ctrl|ui.Alt|ui.Super; mods++ {
				if !view.Shortcut(mods, key) {
					continue
				}
				e.wrapChord = nil
				for _, binding := range bindings {
					if binding.Mods == prefix.Mods && binding.Key == prefix.Key && binding.ThenMods == mods && binding.ThenKey == key {
						if binding.Command == mygoeditor.ToggleSoftWrap {
							e.ToggleWrap()
						} else {
							e.code.Run(binding.Command)
						}
						return
					}
				}
				return
			}
		}
		return
	}
	for _, binding := range bindings {
		if binding.Command != mygoeditor.ToggleSoftWrap {
			continue
		}
		if view.Shortcut(binding.Mods, binding.Key) {
			if binding.ThenKey == ui.KeyUnknown {
				e.ToggleWrap()
			} else {
				prefix := binding
				e.wrapChord = &prefix
			}
		}
	}
}
