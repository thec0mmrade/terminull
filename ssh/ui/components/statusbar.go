package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/ui/theme"
)

// RenderStatusBar renders the bottom status line.
// Format: terminull // vol.N [ PAGE ]     ? help | j/k nav | / search
func RenderStatusBar(page string, volume *int, width int) string {
	left := "terminull"
	if volume != nil {
		left += fmt.Sprintf(" // vol.%d", *volume)
	}
	if page != "" {
		left += fmt.Sprintf(" [ %s ]", page)
	}

	right := "? help | j/k nav | / search"

	gap := width - lipgloss.Width(left) - lipgloss.Width(right)
	if gap < 1 {
		gap = 1
	}

	bar := left + strings.Repeat(" ", gap) + right

	return lipgloss.NewStyle().
		Foreground(theme.Secondary).
		Background(theme.BgSurface).
		Width(width).
		Render(bar)
}
