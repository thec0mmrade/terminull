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

// Version is the engine version, stamped in by publish with
// -ldflags "-X terminull-ssh/ui/components.Version=1.2.3" (from package.json).
// A plain `go build` leaves it as "dev".
var Version = "dev"

// VersionLabel is "terminull v1.2.3", or "terminull dev" for a local build.
func VersionLabel() string {
	if Version == "dev" {
		return "terminull dev"
	}
	return "terminull v" + Version
}

// RenderFooter returns the footer text.
func RenderFooter(width int) string {
	divider := RenderDivider(width)
	line1 := lipgloss.NewStyle().Foreground(theme.Muted).
		Render(VersionLabel() + " // no analytics // no ads // just text")
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
	// Same message as the website (MOTD_TEXT in src/lib/home.js); the BBS has
	// no "help" command, so its hint names only "?".
	text := "Welcome to terminull. This is a space for hackers, researchers, " +
		"artists, and anyone who believes knowledge should be free. " +
		"Press ? for navigation commands."
	return RenderBoxFrame("MESSAGE OF THE DAY", WordWrap(text, boxWidth-4), boxWidth)
}
