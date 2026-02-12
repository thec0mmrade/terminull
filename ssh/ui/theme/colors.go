package theme

import "github.com/charmbracelet/lipgloss"

// terminull color palette — xterm-256 codes matching colors.css
var (
	Green       = lipgloss.Color("148") // #afd700
	GreenBright = lipgloss.Color("191") // #d7ff5f
	GreenDim    = lipgloss.Color("100") // #5f8700
	Gold        = lipgloss.Color("220") // #ffd700
	GoldDim     = lipgloss.Color("136") // #af8700
	Cyan        = lipgloss.Color("81")  // #5fd7ff
	CyanDim     = lipgloss.Color("67")  // #5f87af
	Pink        = lipgloss.Color("206") // #ff5fd7
	PinkDim     = lipgloss.Color("132") // #af5f87
	Red         = lipgloss.Color("203") // #ff5f5f
	Text        = lipgloss.Color("252") // #d0d0d0
	Secondary   = lipgloss.Color("244") // #808080
	Muted       = lipgloss.Color("239") // #4a4a4a
	Border      = lipgloss.Color("236") // #333333
	BorderBright = lipgloss.Color("240") // #555555
	BgDeep      = lipgloss.Color("232") // #080808 (closest to #050505)
	BgPrimary   = lipgloss.Color("233") // #121212 (closest to #0a0a0a)
	BgSurface   = lipgloss.Color("234") // #1c1c1c (closest to #111111)
	BgHighlight = lipgloss.Color("235") // #262626 (closest to #1a1a1a)
)

// CategoryColor returns the Lip Gloss color for a category badge.
func CategoryColor(category string) lipgloss.Color {
	switch category {
	case "guide":
		return Cyan
	case "editorial":
		return Gold
	case "writeup":
		return Green
	case "tool":
		return Pink
	case "security-news":
		return Red
	case "ascii-art":
		return GreenBright
	case "fiction":
		return PinkDim
	case "interview":
		return CyanDim
	default:
		return Secondary
	}
}
