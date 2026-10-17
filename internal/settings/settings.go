package settings

import (
	"jsonpal/locales"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

type State struct {
	Open bool
	components.SettingsState
}

func View(c *ui.Context, state *State) {
	if !state.Open {
		return
	}

	t := c.Theme()
	w, h := c.Size()
	inset := sidebar.HeaderHeight(c)
	width := min(t.Space(180), w*.82, max(0, w-2*inset))
	dialogOptions := components.DialogOptions{Label: locales.Settings(), Inset: inset}
	components.Dialog(c.Key("settings-dialog"), &state.Open, dialogOptions, func(panel ui.Element) {
		panel.Width(width).Height(min(t.Space(110), h*.75)).Padding(0).Gap(0).Clip()
		settingsOptions := components.SettingsOptions{
			Narrow: width < t.Space(170),
			HeaderActions: func(c *ui.Context) {
				if closeButton(c).Clicked() {
					state.Open = false
				}
			},
		}

		categories := []components.SettingsCategory{
			appearance(),
		}

		components.Settings(c, &state.SettingsState, categories, settingsOptions)
	})

}

func closeButton(c *ui.Context) ui.Element {
	button := sidebar.IconButton(
		c.Key("close-settings"),
		lucide.X(),
		locales.WithShortcut(locales.CloseSettings(), "Esc"),
	).Label(locales.CloseSettings())
	return button
}
