package screens

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// SearchScreen provides live search with a text input and results list.
type SearchScreen struct {
	store   *content.Store
	input   textinput.Model
	results []content.SearchResult
	cursor  int
	width   int
	height  int
	inList  bool // true when focus is on results list
}

func NewSearchScreen(store *content.Store, width, height int, initialQuery string) *SearchScreen {
	ti := textinput.New()
	ti.Placeholder = "Search articles..."
	ti.Focus()
	ti.CharLimit = 100
	ti.Width = width - 4
	ti.TextStyle = lipgloss.NewStyle().Foreground(theme.Text)
	ti.PromptStyle = lipgloss.NewStyle().Foreground(theme.Green)
	ti.Prompt = "/ "

	if initialQuery != "" {
		ti.SetValue(initialQuery)
	}

	s := &SearchScreen{
		store:  store,
		input:  ti,
		width:  width,
		height: height,
	}

	if initialQuery != "" {
		s.results = content.Search(store, initialQuery)
	}

	return s
}

func (s *SearchScreen) Init() tea.Cmd {
	return textinput.Blink
}

func (s *SearchScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
		s.input.Width = s.width - 4
		return s, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			if s.inList {
				s.inList = false
				s.input.Focus()
				return s, nil
			}
			return s, backCmd()

		case "tab", "down":
			if !s.inList && len(s.results) > 0 {
				s.inList = true
				s.cursor = 0
				s.input.Blur()
				return s, nil
			}
			if s.inList && s.cursor < len(s.results)-1 {
				s.cursor++
			}
			return s, nil

		case "up":
			if s.inList {
				if s.cursor > 0 {
					s.cursor--
				} else {
					s.inList = false
					s.input.Focus()
				}
				return s, nil
			}

		case "enter":
			if s.inList && s.cursor < len(s.results) {
				r := s.results[s.cursor]
				// Find article index in volume
				artIdx := findArticleIndex(s.store, r.Volume, r.Article.Slug)
				return s, navigateCmd("article", r.Volume, artIdx, "", "")
			}

		case "ctrl+c":
			return s, func() tea.Msg { return tea.QuitMsg{} }
		}
	}

	// Update text input
	if !s.inList {
		var cmd tea.Cmd
		s.input, cmd = s.input.Update(msg)

		// Re-run search on every keystroke
		query := s.input.Value()
		s.results = content.Search(s.store, query)
		s.cursor = 0

		return s, cmd
	}

	return s, nil
}

func (s *SearchScreen) View() string {
	w := s.width
	if w > 78 {
		w = 78
	}

	var b strings.Builder

	// Search input in a box frame
	inputLines := []string{s.input.View()}
	b.WriteString(components.RenderBoxFrame("SEARCH", inputLines, w))
	b.WriteString("\n\n")

	if s.input.Value() == "" {
		hintStyle := lipgloss.NewStyle().Foreground(theme.Muted)
		b.WriteString(hintStyle.Render("  Type to search across titles, descriptions, tags, authors..."))
		b.WriteString("\n")
		return b.String()
	}

	if len(s.results) == 0 {
		hintStyle := lipgloss.NewStyle().Foreground(theme.Secondary)
		b.WriteString(hintStyle.Render("  No results found."))
		b.WriteString("\n")
		return b.String()
	}

	// Results count
	countStyle := lipgloss.NewStyle().Foreground(theme.Secondary)
	b.WriteString(countStyle.Render(fmt.Sprintf("  %d result(s)", len(s.results))))
	b.WriteString("\n\n")

	// Results list
	maxResults := s.height - 8 // rough estimate of available space
	if maxResults < 3 {
		maxResults = 3
	}
	visible := s.results
	if len(visible) > maxResults {
		visible = visible[:maxResults]
	}

	for i, r := range visible {
		vol := fmt.Sprintf("vol.%d", r.Volume)
		cat := r.Article.Category

		catColor := theme.CategoryColor(cat)

		if s.inList && i == s.cursor {
			cursor := lipgloss.NewStyle().Foreground(theme.Green).Render("▸ ")
			titleStyle := lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			metaStyle := lipgloss.NewStyle().Foreground(theme.Green)

			b.WriteString(cursor + titleStyle.Render(r.Article.Title) + "\n")
			b.WriteString("    " + metaStyle.Render(vol) +
				" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("│") +
				" " + lipgloss.NewStyle().Foreground(catColor).Render(cat) +
				" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("│") +
				" " + lipgloss.NewStyle().Foreground(theme.Secondary).Render(r.Article.Author) + "\n")
		} else {
			titleStyle := lipgloss.NewStyle().Foreground(theme.Text)
			metaStyle := lipgloss.NewStyle().Foreground(theme.Secondary)

			b.WriteString("  " + titleStyle.Render(r.Article.Title) + "\n")
			b.WriteString("    " + metaStyle.Render(vol) +
				" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("│") +
				" " + lipgloss.NewStyle().Foreground(catColor).Render(cat) +
				" " + lipgloss.NewStyle().Foreground(theme.Muted).Render("│") +
				" " + metaStyle.Render(r.Article.Author) + "\n")
		}
	}

	if len(s.results) > maxResults {
		moreStyle := lipgloss.NewStyle().Foreground(theme.Muted)
		b.WriteString("\n" + moreStyle.Render(fmt.Sprintf("  ... and %d more results", len(s.results)-maxResults)))
		b.WriteString("\n")
	}

	b.WriteString("\n")
	hintStyle := lipgloss.NewStyle().Foreground(theme.Muted)
	b.WriteString(hintStyle.Render("  Tab/↓ to results  |  Enter to open  |  Esc to close"))
	b.WriteString("\n")

	return b.String()
}

func (s *SearchScreen) StatusInfo() (string, *int) {
	return "SEARCH", nil
}

// findArticleIndex finds the index of an article by slug within its volume.
func findArticleIndex(store *content.Store, volNum int, slug string) int {
	for _, v := range store.Volumes {
		if v.Number == volNum {
			for i, a := range v.Articles {
				if a.Slug == slug {
					return i
				}
			}
		}
	}
	return 0
}
