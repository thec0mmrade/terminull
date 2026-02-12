package components

import (
	"strings"

	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/ui/theme"
)

// RenderBoxFrame draws a box-drawing character frame around content.
// Matches BoxFrame.astro and buildBoxFrame() from ansi-text.ts.
func RenderBoxFrame(title string, lines []string, width int) string {
	if width < 10 {
		width = 10
	}
	innerWidth := width - 2 // account for │ on each side

	borderStyle := lipgloss.NewStyle().Foreground(theme.BorderBright)
	titleStyle := lipgloss.NewStyle().Foreground(theme.Cyan)
	contentStyle := lipgloss.NewStyle().Foreground(theme.Secondary)

	// Top border
	var top string
	if title != "" {
		titleStr := "[ " + title + " ]"
		remaining := innerWidth - 1 - len(titleStr) // -1 for ─ after ┌
		if remaining < 0 {
			remaining = 0
		}
		top = borderStyle.Render("┌─") +
			titleStyle.Render(titleStr) +
			borderStyle.Render(strings.Repeat("─", remaining)+"┐")
	} else {
		top = borderStyle.Render("┌" + strings.Repeat("─", innerWidth) + "┐")
	}

	// Content lines
	var contentLines []string
	for _, line := range lines {
		// Pad line to inner width (accounting for visible length)
		visible := lipgloss.Width(line)
		padding := innerWidth - visible - 1 // -1 for leading space
		if padding < 0 {
			padding = 0
		}
		row := borderStyle.Render("│") + " " +
			contentStyle.Render(line) +
			strings.Repeat(" ", padding) +
			borderStyle.Render("│")
		contentLines = append(contentLines, row)
	}

	// Bottom border
	bottom := borderStyle.Render("└" + strings.Repeat("─", innerWidth) + "┘")

	all := []string{top}
	all = append(all, contentLines...)
	all = append(all, bottom)
	return strings.Join(all, "\n")
}
