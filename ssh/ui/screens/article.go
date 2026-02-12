package screens

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// ArticleScreen displays a single article with scrollable viewport.
type ArticleScreen struct {
	store      *content.Store
	volNum     int
	articleIdx int
	article    *content.Article
	volume     *content.Volume
	viewport   viewport.Model
	width      int
	height     int
	siteURL    string
}

func NewArticleScreen(store *content.Store, volNum, articleIdx, width, height int, siteURL string) *ArticleScreen {
	var vol *content.Volume
	for i := range store.Volumes {
		if store.Volumes[i].Number == volNum {
			vol = &store.Volumes[i]
			break
		}
	}

	var article *content.Article
	if vol != nil && articleIdx >= 0 && articleIdx < len(vol.Articles) {
		article = &vol.Articles[articleIdx]
	}

	a := &ArticleScreen{
		store:      store,
		volNum:     volNum,
		articleIdx: articleIdx,
		article:    article,
		volume:     vol,
		width:      width,
		height:     height,
		siteURL:    siteURL,
	}
	a.initViewport()
	return a
}

func (a *ArticleScreen) initViewport() {
	a.viewport = viewport.New(a.contentWidth(), a.viewportHeight())
	a.viewport.Style = lipgloss.NewStyle()
	a.renderContent()
}

func (a *ArticleScreen) viewportHeight() int {
	h := a.height - 1
	if h < 1 {
		h = 1
	}
	return h
}

func (a *ArticleScreen) Init() tea.Cmd {
	return nil
}

func (a *ArticleScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.viewport.Width = a.contentWidth()
		a.viewport.Height = a.viewportHeight()
		a.renderContent()
		return a, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc":
			return a, backCmd()
		case "?":
			return a, navigateCmd("help", 0, 0, "", "")
		case "/":
			return a, navigateCmd("search", 0, 0, "", "")
		case "p":
			if a.articleIdx > 0 {
				return a, replaceCmd("article", a.volNum, a.articleIdx-1)
			}
			return a, nil
		case "n":
			if a.volume != nil && a.articleIdx < len(a.volume.Articles)-1 {
				return a, replaceCmd("article", a.volNum, a.articleIdx+1)
			}
			return a, nil
		case "g":
			a.viewport.GotoTop()
			return a, nil
		case "G":
			a.viewport.GotoBottom()
			return a, nil
		}
	}

	var cmd tea.Cmd
	a.viewport, cmd = a.viewport.Update(msg)
	return a, cmd
}

func (a *ArticleScreen) contentWidth() int {
	w := a.width
	if w > 78 {
		w = 78
	}
	return w
}

func (a *ArticleScreen) renderContent() {
	if a.article == nil {
		a.viewport.SetContent("Article not found.")
		return
	}

	w := a.contentWidth()
	var b strings.Builder

	// Article metadata header
	dateStr := a.article.Date.Format("2006-01-02")
	authorStr := a.article.Author
	if a.article.Handle != "" {
		authorStr += " (@" + a.article.Handle + ")"
	}
	tagStr := "none"
	if len(a.article.Tags) > 0 {
		tagStr = strings.Join(a.article.Tags, ", ")
	}

	metaLines := []string{
		fmt.Sprintf("Article #%02d  |  %s  |  %s", a.article.Order, strings.ToUpper(a.article.Category), dateStr),
		fmt.Sprintf("Author: %s", authorStr),
		fmt.Sprintf("Tags: %s", tagStr),
	}

	metaTitle := fmt.Sprintf("VOL %d // %s", a.volNum, a.article.Title)
	b.WriteString(components.RenderBoxFrame(metaTitle, metaLines, w))
	b.WriteString("\n\n")

	// Render markdown body
	preprocessed := content.PreprocessMarkdown(a.article.Body, a.siteURL, a.volNum, a.article.Slug)
	renderer, err := theme.NewGlamourRenderer(w - 2)
	if err == nil {
		rendered, err := renderer.Render(preprocessed)
		if err == nil {
			b.WriteString(rendered)
		} else {
			b.WriteString(preprocessed)
		}
	} else {
		b.WriteString(preprocessed)
	}

	b.WriteString("\n")

	// Prev/next navigation
	b.WriteString(components.RenderDivider(w))
	b.WriteString("\n\n")

	navStyle := lipgloss.NewStyle().Foreground(theme.Muted)
	cyanStyle := lipgloss.NewStyle().Foreground(theme.Cyan)

	if a.volume != nil {
		if a.articleIdx > 0 {
			prev := a.volume.Articles[a.articleIdx-1]
			b.WriteString(navStyle.Render("  [p] prev  ") + cyanStyle.Render(prev.Title) + "\n")
		}
		if a.articleIdx < len(a.volume.Articles)-1 {
			next := a.volume.Articles[a.articleIdx+1]
			b.WriteString(navStyle.Render("  [n] next  ") + cyanStyle.Render(next.Title) + "\n")
		}
	}

	b.WriteString("\n")
	b.WriteString(navStyle.Render("  [q] back to table of contents"))
	b.WriteString("\n")

	a.viewport.SetContent(b.String())
}

func (a *ArticleScreen) View() string {
	return a.viewport.View()
}

func (a *ArticleScreen) StatusInfo() (string, *int) {
	vol := a.volNum
	if a.article != nil {
		return a.article.Title, &vol
	}
	return "ARTICLE", &vol
}
