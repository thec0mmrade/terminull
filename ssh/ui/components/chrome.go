package components

import (
	"strings"

	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/ui/theme"
)

// RenderDivider returns a horizontal rule of ─ characters.
func RenderDivider(width int) string {
	style := lipgloss.NewStyle().Foreground(theme.BorderBright)
	return style.Render(strings.Repeat("─", width))
}

// RenderConnectionLine returns a single connection sequence line.
func RenderConnectionLine(text string, bright bool) string {
	color := theme.GreenDim
	if bright {
		color = theme.Green
	}
	return lipgloss.NewStyle().Foreground(color).Render(text)
}

// RenderFooter returns the footer text.
func RenderFooter(width int) string {
	divider := RenderDivider(width)
	line1 := lipgloss.NewStyle().Foreground(theme.Muted).
		Render("terminull v1.0 // no tracking // no ads // just text")
	line2 := lipgloss.NewStyle().Foreground(theme.Muted).
		Render("Ctrl+C to disconnect")
	return divider + "\n" + line1 + "\n" + line2
}

// RenderMOTD returns the "message of the day" section.
func RenderMOTD(width int) string {
	boxWidth := width
	if boxWidth > 78 {
		boxWidth = 78
	}
	lines := []string{
		"Knowledge wants to be free.",
		"Share what you learn. Teach what you know.",
		"The terminal is your canvas.",
	}
	return RenderBoxFrame("MOTD", lines, boxWidth)
}
