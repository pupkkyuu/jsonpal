package settings

import (
	"jsonpal/locales"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

type View struct {
	OnClose             func()
	OnAppearanceChanged func(mygo.ThemeSource)
}

func NewView() *View {
	return &View{}
}

func (v *View) Render(c *ui.Context, state *State, isOpen *bool) {
	if !*isOpen {
		return
	}

	t := c.Theme()
	w, h := c.Size()
	inset := sidebar.HeaderHeight(c)
	width := min(t.Space(180), w*.82, max(0, w-2*inset))
	dialogOptions := components.DialogOptions{Label: locales.Settings(), Inset: inset}
	components.Dialog(c.Key("settings-dialog"), isOpen, dialogOptions, func(panel ui.Element) {
		panel.Width(width).Height(min(t.Space(110), h*.75)).Padding(0).Gap(0).Clip()
		settingsOptions := components.SettingsOptions{
			Narrow: width < t.Space(170),
			HeaderActions: func(c *ui.Context) {
				button := v.closeButton(c)
				if button.Clicked() && v.OnClose != nil {
					v.OnClose()
				}
			},
		}

		categories := []components.SettingsCategory{
			v.appearance(),
		}

		components.Settings(c, &state.SettingsState, categories, settingsOptions)
	})

}

func (v *View) closeButton(c *ui.Context) ui.Element {
	button := sidebar.IconButton(
		c.Key("close-settings"),
		lucide.X(),
		locales.WithShortcut(locales.CloseSettings(), "Esc"),
	).Label(locales.CloseSettings())
	return button
}

func (v *View) appearance() components.SettingsCategory {

	item := components.SettingsGroup{
		ID: "theme",
		Items: []components.SettingsItem{{
			ID:          "theme",
			Title:       locales.Theme(),
			Description: locales.ThemeDescription(),
			Keywords:    []string{locales.LightTheme(), locales.DarkTheme(), locales.SystemTheme(), "Light", "Dark", "System"},
			Build:       v.themeSelector,
		}},
	}

	return components.SettingsCategory{
		ID:     "appearance",
		Title:  locales.Appearance(),
		Icon:   lucide.Palette(),
		Groups: []components.SettingsGroup{item},
	}
}

func (v *View) themeSelector(c *ui.Context) {
	choice := mygo.Theme.Source()

	selectBox := components.Select(c, &choice)

	selectBox.Trigger.
		Label(locales.ThemeSelector()).
		MinWidth(c.Theme().Space(32)).
		MaxWidthPercent(100).
		Children(func() {
			components.Text(c, themeChoiceLabel(choice)).SingleLine()
		})

	selectBox.Popup(func(panel ui.Element) {
		for _, value := range []mygo.ThemeSource{mygo.ThemeSystem, mygo.ThemeLight, mygo.ThemeDark} {
			label := themeChoiceLabel(value)
			selectBox.Item(value).Label(label).Children(func() { components.Text(c, label) })
		}
	})

	if selectBox.Trigger.Changed() && v.OnAppearanceChanged != nil {
		v.OnAppearanceChanged(choice)
		c.Invalidate()
	}
}

func themeChoiceLabel(source mygo.ThemeSource) string {
	switch source {
	case mygo.ThemeLight:
		return locales.LightTheme()
	case mygo.ThemeDark:
		return locales.DarkTheme()
	default:
		return locales.SystemTheme()
	}
}
