package editor

import (
	"github.com/egoist/mygo/ui"
	mygoeditor "github.com/egoist/mygo/ui/editor"

	"jsonpal/locales"
)

// FindBar retains MyGo's default find layout and behavior, adding localized
// labels and shortcut hints through its public renderer hook. The editor still owns
// queries, matching, replacement, keyboard handling and focus.
func FindBar(c *ui.Context, bar ui.Element, f *mygoeditor.FindBar) {
	t := c.Theme()
	bar.Gap(t.Space(1)).Padding(t.Space(1.5)).Background(t.Surface).Border(1, t.Border).Radius(t.Radius).
		Shadow(0, 2, 8, 0, ui.RGBA(0, 0, 0, .18))
	field := func(value *string, placeholder string) ui.Element {
		return ui.TextInputBase(c, value).Width(t.Space(50)).Placeholder(placeholder).Padding(t.Space(1), t.Space(2)).
			Background(t.Background).Border(1, t.Border).Radius(t.Radius - 2).FontSize(t.FontSize - 1).Label(placeholder)
	}
	button := func(glyph, label, hint string) ui.Element {
		b := ui.ButtonBase(c).Padding(t.Space(.5), t.Space(1.5)).Radius(t.Radius - 2).Label(label).Tooltip(hint).KeepFocus()
		b.Children(func() { ui.Text(c, glyph).FontSize(t.FontSize - 1) })
		return b
	}
	bar.Children(func() {
		ui.Row(c).Gap(t.Space(1)).AlignItems(ui.Center).Children(func() {
			f.QueryInput(field(f.Query(), locales.FindQuery()))
			toggle := func(on *bool, glyph, label, hint string) {
				b := ui.ToggleBase(c, on).Padding(t.Space(.5), t.Space(1.5)).Radius(t.Radius - 2).Label(label).Tooltip(hint).KeepFocus()
				if *on {
					b.Background(t.Accent.Alpha(.2)).TextColor(t.Accent)
				}
				b.Children(func() { ui.Text(c, glyph).FontSize(t.FontSize - 1) })
			}
			toggle(f.CaseSensitive(), "Aa", locales.FindMatchCase(), locales.FindMatchCase())
			toggle(f.WholeWord(), "ab", locales.FindWholeWord(), locales.FindWholeWord())
			toggle(f.Regexp(), ".*", locales.FindRegexp(), locales.FindRegexp())
			toggle(f.InSelection(), "[ ]", locales.FindInSelection(), locales.WithShortcut(locales.FindInSelection(), "⌘⌥L"))
			ui.Text(c, f.Status()).FontSize(t.FontSize - 2).TextColor(t.TextMuted).FontFeatures("tnum").MinWidth(t.Space(16)).Role(ui.RoleStatus)
			if button("↑", locales.FindPrevious(), locales.WithShortcut(locales.FindPrevious(), "⌘⇧G")).Clicked() {
				f.Previous()
			}
			if button("↓", locales.FindNext(), locales.WithShortcut(locales.FindNext(), "⌘G")).Clicked() {
				f.Next()
			}
			if f.CanReplace() && button("⇄", locales.FindReplace(), locales.FindOpenReplaceHint()).Clicked() {
				f.SetReplacing(!f.Replacing())
			}
			if button("✕", locales.FindClose(), locales.WithShortcut(locales.FindClose(), "Esc")).Clicked() {
				f.Close()
			}
		})
		if f.Replacing() {
			ui.Row(c).Gap(t.Space(1)).AlignItems(ui.Center).Children(func() {
				f.ReplacementInput(field(f.Replacement(), locales.FindReplace()))
				if ui.Button(c, locales.FindReplace()).Padding(t.Space(.5), t.Space(2)).FontSize(t.FontSize - 1).
					Tooltip(locales.FindReplaceHint()).Clicked() {
					f.Replace()
				}
				if ui.Button(c, locales.FindReplaceAll()).Padding(t.Space(.5), t.Space(2)).FontSize(t.FontSize - 1).
					Tooltip(locales.FindReplaceAllHint()).Clicked() {
					f.ReplaceAll()
				}
			})
		}
	})
}
