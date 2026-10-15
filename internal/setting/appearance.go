package setting

import (
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
)

func (p *Panel) categories() []components.SettingsCategory {
	return []components.SettingsCategory{{
		ID: "appearance", Title: "外观", Icon: lucide.Palette(),
		Groups: []components.SettingsGroup{{
			ID: "theme", Items: []components.SettingsItem{{
				ID: "theme", Title: "主题", Description: "切换后立即生效，自动模式跟随系统外观。",
				Keywords: []string{"明亮", "夜晚", "自动", "Light", "Dark", "System"}, Build: p.themeSelector,
			}},
		}},
	}}
}

func (p *Panel) themeSelector(c *ui.Context) {
	choice := p.appearance
	selectBox := components.Select(c, &choice)
	selectBox.Trigger.Label("主题选择").MinWidth(c.Theme().Space(32)).MaxWidthPercent(100).Children(func() {
		components.Text(c, themeChoiceLabel(choice)).SingleLine()
	})
	selectBox.Popup(func(panel ui.Element) {
		for _, value := range []mygo.ThemeSource{mygo.ThemeLight, mygo.ThemeDark, mygo.ThemeSystem} {
			label := themeChoiceLabel(value)
			selectBox.Item(value).Label(label).Children(func() { components.Text(c, label) })
		}
	})
	if selectBox.Trigger.Changed() && choice != p.appearance {
		p.appearance = choice
		if p.onAppearanceChanged != nil {
			p.onAppearanceChanged(choice)
		}
		c.Invalidate()
	}
}

func themeChoiceLabel(source mygo.ThemeSource) string {
	switch source {
	case mygo.ThemeLight:
		return "明亮"
	case mygo.ThemeDark:
		return "夜晚"
	default:
		return "自动"
	}
}
