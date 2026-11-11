package components

import (
	"fmt"
	"net/url"
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

// SiteHost returns the host of the public site URL (with a port if it has
// one), shown as the BBS node name. It falls back to "terminull.local".
func SiteHost(siteURL string) string {
	u, err := url.Parse(siteURL)
	if err != nil || u.Host == "" {
		return "terminull.local"
	}
	return u.Host
}

// RenderSystemInfo returns the system info box. node is the host shown as
// "Node:" (see SiteHost).
func RenderSystemInfo(username, node string, width int) string {
	dateStr := time.Now().Format("2006-01-02")
	if username == "" {
		username = "guest"
	}

	boxWidth := width
	if boxWidth > 78 {
		boxWidth = 78
	}

	lines := append(connectedLines(dateStr, username, node, boxWidth-3),
		"Protocol: SSH-2.0  |  Term: xterm-256color  |  Charset: UTF-8")

	return RenderBoxFrame("SYSTEM INFO", lines, boxWidth)
}

// connectedLines fits "Connected | User | Node" into max columns: on one
// line if it fits, else with the username shortened with "…", else (narrow
// terminals) with the node on a line of its own.
func connectedLines(dateStr, username, node string, max int) []string {
	prefix := fmt.Sprintf("Connected: %s  |  User: ", dateStr)
	suffix := "  |  Node: " + node
	if lipgloss.Width(prefix+username+suffix) <= max {
		return []string{prefix + username + suffix}
	}
	const minUser = 8 // shorter than this is no longer recognisable
	if room := max - lipgloss.Width(prefix) - lipgloss.Width(suffix); room >= minUser {
		return []string{prefix + truncateRunes(username, room) + suffix}
	}
	room := max - lipgloss.Width(prefix)
	if room < 1 {
		room = 1
	}
	return []string{prefix + truncateRunes(username, room), "Node: " + node}
}

// truncateRunes shortens s to at most n display columns, ending in "…".
func truncateRunes(s string, n int) string {
	if lipgloss.Width(s) <= n {
		return s
	}
	r := []rune(s)
	for len(r) > 0 && lipgloss.Width(string(r))+1 > n {
		r = r[:len(r)-1]
	}
	return string(r) + "…"
}
