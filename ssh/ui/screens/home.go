package screens

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// Connection animation phases
const (
	phaseConnecting = iota
	phaseIdentity
	phaseLoading
	phaseDone
)

type connectTickMsg struct{}

// HomeScreen shows connection animation then main menu.
type HomeScreen struct {
	store    *content.Store
	width    int
	height   int
	username string
	siteURL  string
	phase    int
	cursor   int
	items    []menuItem
}

type menuItem struct {
	label       string
	description string
	action      string // "volume", "page", "help"
	volume      int
	pageSlug    string
}

func NewHomeScreen(store *content.Store, width, height int, username, siteURL string) *HomeScreen {
	var items []menuItem

	// Add volumes
	for _, v := range store.Volumes {
		items = append(items, menuItem{
			label:       fmt.Sprintf("Vol %d — Table of Contents", v.Number),
			description: fmt.Sprintf("%d articles", len(v.Articles)),
			action:      "volume",
			volume:      v.Number,
		})
	}

	// Add static pages
	for _, p := range store.Pages {
		items = append(items, menuItem{
			label:       p.Title,
			description: p.Description,
			action:      "page",
			pageSlug:    p.Slug,
		})
	}

	// Help
	items = append(items, menuItem{
		label:       "Help — Keyboard Reference",
		description: "Navigation and key bindings",
		action:      "help",
	})

	return &HomeScreen{
		store:    store,
		width:    width,
		height:   height,
		username: username,
		siteURL:  siteURL,
		phase:    phaseConnecting,
		items:    items,
	}
}

func (h *HomeScreen) Init() tea.Cmd {
	return tea.Tick(300*time.Millisecond, func(t time.Time) tea.Msg {
		return connectTickMsg{}
	})
}

func (h *HomeScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h.width = msg.Width
		h.height = msg.Height
		return h, nil

	case connectTickMsg:
		if h.phase < phaseDone {
			h.phase++
			return h, tea.Tick(300*time.Millisecond, func(t time.Time) tea.Msg {
				return connectTickMsg{}
			})
		}
		return h, nil

	case tea.KeyMsg:
		if h.phase < phaseDone {
			// Skip animation on any key
			h.phase = phaseDone
			return h, nil
		}

		switch msg.String() {
		case "j", "down":
			if h.cursor < len(h.items)-1 {
				h.cursor++
			}
			return h, nil
		case "k", "up":
			if h.cursor > 0 {
				h.cursor--
			}
			return h, nil
		case "enter":
			return h, h.selectItem(h.cursor)
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			idx := int(msg.String()[0]-'0') - 1
			if idx < len(h.items) {
				h.cursor = idx
				return h, h.selectItem(idx)
			}
			return h, nil
		case "0":
			idx := 9
			if idx < len(h.items) {
				h.cursor = idx
				return h, h.selectItem(idx)
			}
			return h, nil
		case "?":
			return h, navigateCmd("help", 0, 0, "", "")
		case "/":
			return h, navigateCmd("search", 0, 0, "", "")
		case "q":
			return h, func() tea.Msg { return tea.QuitMsg{} }
		}
	}

	return h, nil
}

func (h *HomeScreen) selectItem(idx int) tea.Cmd {
	if idx < 0 || idx >= len(h.items) {
		return nil
	}
	item := h.items[idx]
	switch item.action {
	case "volume":
		return navigateCmd("volume", item.volume, 0, "", "")
	case "page":
		return navigateCmd("page", 0, 0, item.pageSlug, "")
	case "help":
		return navigateCmd("help", 0, 0, "", "")
	}
	return nil
}

func (h *HomeScreen) View() string {
	w := h.width
	if w > 78 {
		w = 78
	}

	var b strings.Builder

	// Connection sequence animation
	connLines := []struct {
		text   string
		bright bool
	}{
		{"Connecting to terminull.local...", false},
		{"SSH-2.0 | xterm-256color | UTF-8", false},
		{"Identity verified.", false},
		{"Connection established.", true},
	}

	for i := 0; i <= h.phase && i < len(connLines); i++ {
		cl := connLines[i]
		b.WriteString(components.RenderConnectionLine(cl.text, cl.bright))
		b.WriteString("\n")
	}

	if h.phase < phaseDone {
		return b.String()
	}

	b.WriteString("\n")

	// Logo
	b.WriteString(components.RenderLogo(w))
	b.WriteString("\n")

	// Tagline
	latestVol := 0
	if len(h.store.Volumes) > 0 {
		latestVol = h.store.Volumes[len(h.store.Volumes)-1].Number
	}
	b.WriteString(components.RenderTagline(latestVol, w))
	b.WriteString("\n\n")

	// System info
	b.WriteString(components.RenderSystemInfo(h.username, w))
	b.WriteString("\n\n")

	// Menu
	titleStyle := lipgloss.NewStyle().Foreground(theme.Gold).Bold(true)
	b.WriteString(titleStyle.Render("MAIN MENU"))
	b.WriteString("\n")
	b.WriteString(components.RenderDivider(w))
	b.WriteString("\n\n")

	for i, item := range h.items {
		num := fmt.Sprintf("[%d]", i+1)
		if i == h.cursor {
			numStyle := lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			labelStyle := lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			descStyle := lipgloss.NewStyle().Foreground(theme.Green)
			cursor := lipgloss.NewStyle().Foreground(theme.Green).Render("▸ ")
			b.WriteString(cursor + numStyle.Render(num) + " " + labelStyle.Render(item.label))
			if item.description != "" {
				b.WriteString(" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("─") + " " + descStyle.Render(item.description))
			}
		} else {
			numStyle := lipgloss.NewStyle().Foreground(theme.Green).Bold(true)
			labelStyle := lipgloss.NewStyle().Foreground(theme.Text)
			descStyle := lipgloss.NewStyle().Foreground(theme.Secondary)
			b.WriteString("  " + numStyle.Render(num) + " " + labelStyle.Render(item.label))
			if item.description != "" {
				b.WriteString(" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("─") + " " + descStyle.Render(item.description))
			}
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")

	// MOTD
	b.WriteString(components.RenderMOTD(w))
	b.WriteString("\n\n")

	// Footer
	b.WriteString(components.RenderFooter(w))
	b.WriteString("\n")

	return b.String()
}

func (h *HomeScreen) StatusInfo() (string, *int) {
	return "HOME", nil
}
