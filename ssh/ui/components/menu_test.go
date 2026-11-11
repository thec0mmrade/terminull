package components

import (
	"strings"
	"testing"

	"github.com/charmbracelet/lipgloss"
)

func TestMenuKeyIndex(t *testing.T) {
	for _, c := range []struct {
		key  string
		n    int
		want int
		ok   bool
	}{
		{"0", 5, 0, true}, {"4", 5, 4, true}, {"5", 5, 5, false}, {"a", 5, 0, false}, {"10", 20, 0, false},
	} {
		got, ok := MenuKeyIndex(c.key, c.n)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("MenuKeyIndex(%q, %d) = %d, %v; want %d, %v", c.key, c.n, got, ok, c.want, c.ok)
		}
	}
}

func TestVolumeSummaryMatchesWebsite(t *testing.T) {
	// Same strings as volumeSummary() in src/lib/home.js.
	if got := VolumeSummary(1, 12); got != "Volume 01, 12 articles" {
		t.Errorf("got %q", got)
	}
	if got := VolumeSummary(12, 1); got != "Volume 12, 1 article" {
		t.Errorf("got %q", got)
	}
}

func TestRenderMenuNumbersFromZero(t *testing.T) {
	out := RenderMenu([]MenuEntry{{"Latest Volume", "Volume 01, 12 articles"}, {"Archive", "All volumes"}}, 0)
	for _, want := range []string{"[00]", "Latest Volume", "[01]", "Archive - All volumes"} {
		if !strings.Contains(stripANSI(out), want) {
			t.Errorf("menu missing %q:\n%s", want, stripANSI(out))
		}
	}
}

func TestWordWrap(t *testing.T) {
	lines := WordWrap("Welcome to terminull. This is a space for hackers, researchers, artists.", 20)
	for _, l := range lines {
		if lipgloss.Width(l) > 20 {
			t.Errorf("line %q is wider than 20", l)
		}
	}
	if strings.Join(lines, " ") != "Welcome to terminull. This is a space for hackers, researchers, artists." {
		t.Errorf("words lost or reordered: %q", lines)
	}
}

func stripANSI(s string) string {
	var b strings.Builder
	esc := false
	for _, r := range s {
		switch {
		case r == 0x1b:
			esc = true
		case esc && (r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z'):
			esc = false
		case !esc:
			b.WriteRune(r)
		}
	}
	return b.String()
}
