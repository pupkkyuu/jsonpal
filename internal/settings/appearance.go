package settings

import (
	"jsonpal/locales"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
)

func appearance() components.SettingsCategory {

	item := components.SettingsGroup{
		ID: "theme",
		Items: []components.SettingsItem{{
			ID:          "theme",
			Title:       locales.Theme(),
			Description: locales.ThemeDescription(),
			Keywords:    []string{locales.LightTheme(), locales.DarkTheme(), locales.SystemTheme(), "Light", "Dark", "System"},
			Build:       themeSelector,
		}},
	}

	return components.SettingsCategory{
		ID:     "appearance",
		Title:  locales.Appearance(),
		Icon:   lucide.Palette(),
		Groups: []components.SettingsGroup{item},
	}
}

func themeSelector(c *ui.Context) {
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

	if selectBox.Trigger.Changed() {
		mygo.Theme.SetSource(choice)
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
