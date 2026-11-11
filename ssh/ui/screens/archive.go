package screens

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// ArchiveScreen lists every volume, like the website's /vol page.
type ArchiveScreen struct {
	store  *content.Store
	width  int
	height int
	cursor int
}

func NewArchiveScreen(store *content.Store, width, height int) *ArchiveScreen {
	return &ArchiveScreen{store: store, width: width, height: height}
}

func (a *ArchiveScreen) Init() tea.Cmd { return nil }

func (a *ArchiveScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		return a, nil

	case tea.KeyMsg:
		n := len(a.store.Volumes)
		switch msg.String() {
		case "j", "down":
			if a.cursor < n-1 {
				a.cursor++
			}
			return a, nil
		case "k", "up":
			if a.cursor > 0 {
				a.cursor--
			}
			return a, nil
		case "enter":
			return a, a.open(a.cursor)
		case "q", "esc":
			return a, backCmd()
		case "?":
			return a, navigateCmd("help", 0, 0, "", "")
		case "/":
			return a, navigateCmd("search", 0, 0, "", "")
		}
		if idx, ok := components.MenuKeyIndex(msg.String(), n); ok {
			a.cursor = idx
			return a, a.open(idx)
		}
	}
	return a, nil
}

func (a *ArchiveScreen) open(idx int) tea.Cmd {
	if idx < 0 || idx >= len(a.store.Volumes) {
		return nil
	}
	return navigateCmd("volume", a.store.Volumes[idx].Number, 0, "", "")
}

func (a *ArchiveScreen) View() string {
	w := a.width
	if w > 78 {
		w = 78
	}

	var b strings.Builder
	titleStyle := lipgloss.NewStyle().Foreground(theme.Gold).Bold(true)
	b.WriteString(titleStyle.Render("VOLUME ARCHIVE"))
	b.WriteString("\n")
	b.WriteString(components.RenderDivider(w))
	b.WriteString("\n\n")

	if len(a.store.Volumes) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(theme.Secondary).Render("  No volumes published yet."))
		b.WriteString("\n")
		return b.String()
	}

	b.WriteString(titleStyle.Render("AVAILABLE VOLUMES"))
	b.WriteString("\n\n")
	entries := make([]components.MenuEntry, len(a.store.Volumes))
	for i, v := range a.store.Volumes {
		entries[i] = components.MenuEntry{
			Label:       components.VolumeLabel(v.Number),
			Description: components.ArticleCount(len(v.Articles)),
		}
	}
	b.WriteString(components.RenderMenu(entries, a.cursor))

	b.WriteString("\n")
	hintStyle := lipgloss.NewStyle().Foreground(theme.Muted)
	b.WriteString(hintStyle.Render("  More volumes coming soon.  Enter to open  |  j/k navigate  |  q back"))
	b.WriteString("\n")
	return b.String()
}

func (a *ArchiveScreen) StatusInfo() (string, *int) {
	return "ARCHIVE", nil
}
