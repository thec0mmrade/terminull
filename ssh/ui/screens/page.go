package screens

import (
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/theme"
)

// PageScreen displays a static page (about, manifesto) with scrollable viewport.
type PageScreen struct {
	store    *content.Store
	page     *content.Page
	viewport viewport.Model
	width    int
	height   int
	ready    bool
}

func NewPageScreen(store *content.Store, slug string, width, height int) *PageScreen {
	var page *content.Page
	for i := range store.Pages {
		if store.Pages[i].Slug == slug {
			page = &store.Pages[i]
			break
		}
	}

	s := &PageScreen{
		store:  store,
		page:   page,
		width:  width,
		height: height,
	}
	s.initViewport()
	return s
}

func (p *PageScreen) initViewport() {
	p.viewport = viewport.New(p.contentWidth(), p.viewportHeight())
	p.viewport.Style = lipgloss.NewStyle()
	p.renderContent()
	p.ready = true
}

func (p *PageScreen) viewportHeight() int {
	h := p.height - 1
	if h < 1 {
		h = 1
	}
	return h
}

func (p *PageScreen) Init() tea.Cmd { return nil }

func (p *PageScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		p.viewport.Width = p.contentWidth()
		p.viewport.Height = p.viewportHeight()
		p.renderContent()
		return p, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc":
			return p, backCmd()
		case "?":
			return p, navigateCmd("help", 0, 0, "", "")
		case "/":
			return p, navigateCmd("search", 0, 0, "", "")
		case "g":
			p.viewport.GotoTop()
			return p, nil
		case "G":
			p.viewport.GotoBottom()
			return p, nil
		}
	}

	var cmd tea.Cmd
	p.viewport, cmd = p.viewport.Update(msg)
	return p, cmd
}

func (p *PageScreen) contentWidth() int {
	w := p.width
	if w > 78 {
		w = 78
	}
	return w
}

func (p *PageScreen) renderContent() {
	if p.page == nil {
		p.viewport.SetContent("Page not found.")
		return
	}

	w := p.contentWidth()
	var b strings.Builder

	// Title
	titleStyle := lipgloss.NewStyle().Foreground(theme.Gold).Bold(true)
	b.WriteString(titleStyle.Render(strings.ToUpper(p.page.Title)))
	b.WriteString("\n")

	divider := lipgloss.NewStyle().Foreground(theme.BorderBright).Render(strings.Repeat("─", w))
	b.WriteString(divider)
	b.WriteString("\n\n")

	// Render markdown body
	renderer, err := theme.NewGlamourRenderer(w - 2)
	if err == nil {
		rendered, err := renderer.Render(p.page.Body)
		if err == nil {
			b.WriteString(rendered)
		} else {
			b.WriteString(p.page.Body)
		}
	} else {
		b.WriteString(p.page.Body)
	}

	p.viewport.SetContent(b.String())
}

func (p *PageScreen) View() string {
	return p.viewport.View()
}

func (p *PageScreen) StatusInfo() (string, *int) {
	if p.page != nil {
		return strings.ToUpper(p.page.Title), nil
	}
	return "PAGE", nil
}
