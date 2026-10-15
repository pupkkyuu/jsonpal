// Package setting owns the settings panel and appearance preferences.
// It is independent of workspace navigation and editor implementations.
package setting

import (
	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

// Panel owns the settings dialog, navigation and current appearance preference.
// The host applies changes through the callback supplied to NewPanel.
type Panel struct {
	open                bool
	view                components.SettingsState
	appearance          mygo.ThemeSource
	onAppearanceChanged func(mygo.ThemeSource)
}

func NewPanel(appearance mygo.ThemeSource, onAppearanceChanged func(mygo.ThemeSource)) *Panel {
	return &Panel{appearance: appearance, onAppearanceChanged: onAppearanceChanged}
}

func (p *Panel) Open()                        { p.open = true }
func (p *Panel) IsOpen() bool                 { return p.open }
func (p *Panel) Appearance() mygo.ThemeSource { return p.appearance }

func (p *Panel) View(c *ui.Context) {
	if !p.open {
		return
	}
	t := c.Theme()
	w, h := c.Size()
	inset := sidebar.HeaderHeight(c)
	width := min(t.Space(180), w*.82, max(0, w-2*inset))
	components.Dialog(c.Key("settings-dialog"), &p.open, components.DialogOptions{Label: "设置", Inset: inset}, func(panel ui.Element) {
		panel.Width(width).Height(min(t.Space(110), h*.75)).Padding(0).Gap(0).Clip()
		components.Settings(c, &p.view, p.categories(), components.SettingsOptions{
			Narrow: width < t.Space(170), Title: "设置",
			SearchLabel: "搜索设置", SearchPlaceholder: "搜索设置",
			CategoryLabel: "设置分类", ResultsTitle: "搜索结果", EmptyText: "没有找到匹配的设置",
			HeaderActions: func(c *ui.Context) {
				if sidebar.IconButton(c.Key("close-settings"), lucide.X(), "关闭设置（Esc）").Label("关闭设置").Clicked() {
					p.open = false
				}
			},
		})
	})
}
