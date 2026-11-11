package screens

import (
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
	action      string // "volume", "archive", "page", "help"
	volume      int
	pageSlug    string
}

// mainMenu is the website's main menu (src/lib/home.js), numbered from [00]:
// Latest Volume (when one is published), Archive, About, Manifesto, Help.
// Keep the two in step. About and Manifesto appear only if the page exists.
func mainMenu(store *content.Store) []menuItem {
	var items []menuItem
	if n := len(store.Volumes); n > 0 {
		latest := store.Volumes[n-1]
		items = append(items, menuItem{
			label:       "Latest Volume",
			description: components.VolumeSummary(latest.Number, len(latest.Articles)),
			action:      "volume",
			volume:      latest.Number,
		})
	}
	items = append(items, menuItem{label: "Archive", description: "All volumes", action: "archive"})
	pages := map[string]bool{}
	for _, p := range store.Pages {
		pages[p.Slug] = true
	}
	for _, p := range []struct{ slug, label, description string }{
		{"about", "About", "What is terminull?"},
		{"manifesto", "Manifesto", "What we believe"},
	} {
		if pages[p.slug] {
			items = append(items, menuItem{label: p.label, description: p.description, action: "page", pageSlug: p.slug})
		}
	}
	return append(items, menuItem{label: "Help", description: "Commands & navigation", action: "help"})
}

func NewHomeScreen(store *content.Store, width, height int, username, siteURL string) *HomeScreen {
	items := mainMenu(store)

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
		case "?":
			return h, navigateCmd("help", 0, 0, "", "")
		case "/":
			return h, navigateCmd("search", 0, 0, "", "")
		case "q":
			return h, func() tea.Msg { return tea.QuitMsg{} }
		}
		// Digits pick a menu item by its number: 0 is [00].
		if idx, ok := components.MenuKeyIndex(msg.String(), len(h.items)); ok {
			h.cursor = idx
			return h, h.selectItem(idx)
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
	case "archive":
		return navigateCmd("archive", 0, 0, "", "")
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
		{"Connecting to " + components.SiteHost(h.siteURL) + "...", false},
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
	b.WriteString(components.RenderSystemInfo(h.username, components.SiteHost(h.siteURL), w))
	b.WriteString("\n\n")

	// Menu
	titleStyle := lipgloss.NewStyle().Foreground(theme.Gold).Bold(true)
	b.WriteString(titleStyle.Render("MAIN MENU"))
	b.WriteString("\n")
	b.WriteString(components.RenderDivider(w))
	b.WriteString("\n\n")

	entries := make([]components.MenuEntry, len(h.items))
	for i, item := range h.items {
		entries[i] = components.MenuEntry{Label: item.label, Description: item.description}
	}
	b.WriteString(components.RenderMenu(entries, h.cursor))

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
