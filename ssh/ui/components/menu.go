package components

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/ui/theme"
)

// MenuEntry is one numbered menu line: "[00] Label - Description".
type MenuEntry struct {
	Label       string
	Description string
}

// RenderMenu draws a numbered menu, numbered from [00] like the website's
// menus, with the entry at cursor highlighted.
func RenderMenu(entries []MenuEntry, cursor int) string {
	var b strings.Builder
	for i, e := range entries {
		num := fmt.Sprintf("[%02d]", i)
		numStyle := lipgloss.NewStyle().Foreground(theme.Green).Bold(true)
		labelStyle := lipgloss.NewStyle().Foreground(theme.Text)
		descStyle := lipgloss.NewStyle().Foreground(theme.Secondary)
		prefix := "  "
		if i == cursor {
			numStyle = lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			labelStyle = lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			descStyle = lipgloss.NewStyle().Foreground(theme.Green)
			prefix = lipgloss.NewStyle().Foreground(theme.Green).Render("▸ ")
		}
		b.WriteString(prefix + numStyle.Render(num) + " " + labelStyle.Render(e.Label))
		if e.Description != "" {
			b.WriteString(" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("-") + " " + descStyle.Render(e.Description))
		}
		b.WriteString("\n")
	}
	return b.String()
}

// MenuKeyIndex maps a digit key to a menu index: "0" is [00], "9" is [09].
// ok is false for other keys or an index past the end of the menu.
func MenuKeyIndex(key string, length int) (int, bool) {
	if len(key) != 1 || key[0] < '0' || key[0] > '9' {
		return 0, false
	}
	idx := int(key[0] - '0')
	return idx, idx < length
}

// VolumeLabel is "Volume 01", as on the website.
func VolumeLabel(volume int) string {
	return fmt.Sprintf("Volume %02d", volume)
}

// ArticleCount is "12 articles" or "1 article".
func ArticleCount(n int) string {
	if n == 1 {
		return "1 article"
	}
	return fmt.Sprintf("%d articles", n)
}

// VolumeSummary is "Volume 01, 12 articles", as on the website's menu.
func VolumeSummary(volume, articles int) string {
	return VolumeLabel(volume) + ", " + ArticleCount(articles)
}

// WordWrap breaks text into lines of at most width columns at spaces.
func WordWrap(text string, width int) []string {
	var lines []string
	line := ""
	for _, word := range strings.Fields(text) {
		if line != "" && lipgloss.Width(line)+1+lipgloss.Width(word) > width {
			lines = append(lines, line)
			line = word
			continue
		}
		if line == "" {
			line = word
		} else {
			line += " " + word
		}
	}
	if line != "" {
		lines = append(lines, line)
	}
	return lines
}
