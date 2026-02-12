package theme

import "github.com/charmbracelet/lipgloss"

// Reusable Lip Gloss styles for the TUI.
var (
	TitleStyle = lipgloss.NewStyle().
			Foreground(Gold).
			Bold(true)

	SubtitleStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true)

	MutedStyle = lipgloss.NewStyle().
			Foreground(Muted)

	SecondaryStyle = lipgloss.NewStyle().
			Foreground(Secondary)

	TextStyle = lipgloss.NewStyle().
			Foreground(Text)

	GreenStyle = lipgloss.NewStyle().
			Foreground(Green)

	GreenBoldStyle = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)

	CyanStyle = lipgloss.NewStyle().
			Foreground(Cyan)

	PinkStyle = lipgloss.NewStyle().
			Foreground(Pink)

	RedStyle = lipgloss.NewStyle().
			Foreground(Red)

	GoldDimStyle = lipgloss.NewStyle().
			Foreground(GoldDim)

	ActiveItemStyle = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true).
			PaddingLeft(1).
			BorderLeft(true).
			BorderStyle(lipgloss.ThickBorder()).
			BorderForeground(Green)

	InactiveItemStyle = lipgloss.NewStyle().
				Foreground(Text).
				PaddingLeft(2)

	StatusBarStyle = lipgloss.NewStyle().
			Foreground(Secondary).
			Background(BgSurface)

	StatusBarActiveStyle = lipgloss.NewStyle().
				Foreground(Green).
				Background(BgSurface).
				Bold(true)
)
