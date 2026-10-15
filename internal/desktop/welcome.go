package desktop

import (
	"math"
	"sync"

	"github.com/egoist/mygo/ui"
	"github.com/oneo-me/onevra/source/components"
	"github.com/oneo-me/onevra/source/icons/lucide"
	"github.com/oneo-me/onevra/source/shells/sidebar"
)

var welcomeSky = ui.Hex("#519db3")

func (app *application) welcome(c *ui.Context) {
	t := c.Theme()
	page := ui.Column(c.Key("welcome")).Fill().MinWidth(0).Clip().Label("欢迎背景").
		Gradient(t.Background.Mix(t.Accent, .07), t.Background, 150)
	page.Draw(func(p *ui.Painter, r ui.Rect) {
		strength := float32(1)
		if t.Dark {
			strength = .7
		}
		size := .35 * max(r.W, r.H)
		p.Clip(r, 0, func() {
			p.Shadow(ui.Rect{X: r.X + r.W, Y: r.Y, W: 1, H: 1}, .5, 0, 0, size, size*.35, t.Accent.Alpha(.14*strength))
			p.Shadow(ui.Rect{X: r.X, Y: r.Y + r.H, W: 1, H: 1}, .5, 0, 0, size, size*.35, welcomeSky.Alpha(.16*strength))
		})
	})
	page.Children(func() {
		welcomeIconField(c)
		ui.Column(c.Key("welcome-title")).Fill().MinWidth(0).Justify(ui.Center).AlignItems(ui.Center).
			Padding(sidebar.HeaderHeight(c), t.Space(6), 0, t.Space(6)).Gap(t.Space(3)).Children(func() {
			components.Icon(c, lucide.Braces()).Size(t.Space(10), t.Space(10)).TextColor(t.Accent)
			components.Text(c, "JSONPal").FontSize(t.Rem(2.5)).SingleLine()
			components.Text(c, "从侧边栏新建格式化或对比，开始处理 JSON").TextColor(t.TextMuted).TextAlign(ui.Center).Wrap()
		})
	})
}

// Adapted from Onevra Gallery's welcomeIconField: a clipped, tilted lattice
// painted directly, with a diagonal tint and a quieter center for the title.
func welcomeIconField(c *ui.Context) {
	t := c.Theme()
	step, size := t.Space(13), t.Space(5)
	alpha := float32(.13)
	if t.Dark {
		alpha = .16
	}
	icons := welcomeFieldIcons()
	ui.Box(c.Key("icon-field")).Absolute().Left(0).Top(0).Right(0).Bottom(0).Clip().PassThrough().Children(func() {
		ui.Box(c).Absolute().LeftPercent(-25).TopPercent(-25).WidthPercent(150).HeightPercent(150).
			Rotate(-14).PassThrough().Draw(func(p *ui.Painter, r ui.Rect) {
			cx, cy := r.X+r.W/2, r.Y+r.H/2
			reach := float32(math.Hypot(float64(r.W/1.5), float64(r.H/1.5))) / 2
			if reach == 0 {
				return
			}
			for row := 0; float32(row)*step < r.H; row++ {
				offset := float32(row%2) * step / 2
				for col := 0; float32(col)*step < r.W+step; col++ {
					x, y := r.X+float32(col)*step-offset, r.Y+float32(row)*step
					diagonal := min(1, max(0, (x-r.X)/r.W*.5+(1-(y-r.Y)/r.H)*.5))
					dx, dy := (x-cx)/reach, (y-cy)/reach
					center := min(1, max(.25, float32(math.Sqrt(float64(dx*dx+dy*dy)))*1.4))
					color := welcomeSky.Mix(t.Accent, diagonal)
					icon := icons[(row*7+col*3)%len(icons)]
					p.Icon(icon, ui.Rect{X: x, Y: y, W: size, H: size}, color.Alpha(alpha*center*(.45+diagonal*.55)))
				}
			}
		})
	})
}

// Lucide assets are parsed once, rather than once for each icon or frame.
var welcomeFieldIcons = sync.OnceValue(func() []*ui.SVG {
	return []*ui.SVG{
		lucide.Braces(), lucide.Brackets(), lucide.FileDiff(), lucide.FileCode(),
		lucide.Code(), lucide.Copy(), lucide.Search(), lucide.TextWrap(),
		lucide.ArrowDownAZ(), lucide.ChevronsUpDown(), lucide.Settings(), lucide.Plus(),
		lucide.FileText(), lucide.Folder(), lucide.Layers(), lucide.Database(),
		lucide.Hash(), lucide.GitBranch(), lucide.Check(), lucide.SquareCode(),
	}
})
