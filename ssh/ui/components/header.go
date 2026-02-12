package components

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/art"
	"terminull-ssh/ui/theme"
)

// RenderLogo returns the ASCII logo colored green.
func RenderLogo(width int) string {
	logoStyle := lipgloss.NewStyle().Foreground(theme.Green)
	logo := strings.TrimRight(art.Logo, "\n")

	// Center logo if terminal is wide enough
	lines := strings.Split(logo, "\n")
	var result []string
	for _, line := range lines {
		result = append(result, logoStyle.Render(line))
	}
	return strings.Join(result, "\n")
}

// RenderTagline returns the centered tagline.
func RenderTagline(latestVolume int, width int) string {
	tagBase := "h a c k e r   e - z i n e"
	var tagline string
	if latestVolume > 0 {
		tagline = fmt.Sprintf("[ %s   / /   v o l . %d ]", tagBase, latestVolume)
	} else {
		tagline = fmt.Sprintf("[ %s ]", tagBase)
	}

	style := lipgloss.NewStyle().Foreground(theme.Green)
	pad := (width - len(tagline)) / 2
	if pad < 0 {
		pad = 0
	}
	return strings.Repeat(" ", pad) + style.Render(tagline)
}

// RenderSystemInfo returns the system info box.
func RenderSystemInfo(username string, width int) string {
	dateStr := time.Now().Format("2006-01-02")
	if username == "" {
		username = "guest"
	}

	boxWidth := width
	if boxWidth > 78 {
		boxWidth = 78
	}

	lines := []string{
		fmt.Sprintf("Connected: %s  |  User: %s  |  Node: terminull.local", dateStr, username),
		"Protocol: SSH-2.0  |  Term: xterm-256color  |  Charset: UTF-8",
	}

	return RenderBoxFrame("SYSTEM INFO", lines, boxWidth)
}
