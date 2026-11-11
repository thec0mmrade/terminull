package components

import (
	"strings"
	"testing"

	"github.com/charmbracelet/lipgloss"
)

func TestSiteHost(t *testing.T) {
	cases := map[string]string{
		"https://terminull.local":       "terminull.local",
		"https://zine.example.com/":     "zine.example.com",
		"http://localhost:4321":         "localhost:4321",
		"":                              "terminull.local",
		"not a url":                     "terminull.local",
		"https://zine.example.com/path": "zine.example.com",
	}
	for in, want := range cases {
		if got := SiteHost(in); got != want {
			t.Errorf("SiteHost(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestConnectedLinesFit(t *testing.T) {
	long := "abcdefghijklmnopqrstuvwxyz012345" // 32, the BBS's username cap
	host := "terminull.example.com"
	for _, width := range []int{78, 60} {
		max := width - 3
		for _, user := range []string{"guest", "c0mmrade", long} {
			lines := connectedLines("2026-11-11", user, host, max)
			for _, l := range lines {
				if w := lipgloss.Width(l); w > max {
					t.Errorf("width %d, user %q: line %q is %d wide, max %d", width, user, l, w, max)
				}
			}
			if !strings.Contains(strings.Join(lines, "\n"), host) {
				t.Errorf("width %d, user %q: node missing from %q", width, user, lines)
			}
		}
	}
	if got := connectedLines("2026-11-11", "guest", host, 75); len(got) != 1 || !strings.Contains(got[0], "User: guest  |") {
		t.Errorf("short username should fit on one line unchanged: %q", got)
	}
}
