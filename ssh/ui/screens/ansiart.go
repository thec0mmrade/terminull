package screens

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
	"terminull-ssh/ui/types"
)

// An article that is one piece of ANSI art, drawn in cell by cell at modem
// speed. The view follows the drawing edge while the reader is at the
// bottom; scrolling up detaches it, scrolling back re-attaches.

const (
	ansiBaud     = 9600
	ansiTickRate = 33 * time.Millisecond
	// A gap between ticks longer than this means the screen was covered
	// (help, search) or the session stalled: the drawing pauses.
	ansiMaxStep = 100 * time.Millisecond
)

type ansiTickMsg struct{ screen *AnsiArtScreen }

// AnsiArtScreen plays an ANSI art article.
type AnsiArtScreen struct {
	store      *content.Store
	volNum     int
	articleIdx int
	article    *content.Article
	volume     *content.Volume
	art        *content.AnsiArt
	viewport   viewport.Model
	width      int
	height     int

	header   string
	done     []string // fully drawn rows, rendered
	cursor   content.AnsiCursor
	elapsed  time.Duration // drawing time so far, excluding pauses
	lastTick time.Time
	finished bool
}

// NewArticleScreenFor returns the right screen for an article: the ANSI art
// player if it has art, the markdown reader otherwise. fullWidth is the
// terminal width; contentWidth is the capped reading width.
func NewArticleScreenFor(store *content.Store, volNum, articleIdx, fullWidth, contentWidth, height int, siteURL string) types.Screen {
	for i := range store.Volumes {
		v := &store.Volumes[i]
		if v.Number == volNum && articleIdx >= 0 && articleIdx < len(v.Articles) && v.Articles[articleIdx].Art != nil {
			return newAnsiArtScreen(store, v, articleIdx, fullWidth, height)
		}
	}
	return NewArticleScreen(store, volNum, articleIdx, contentWidth, height, siteURL)
}

func newAnsiArtScreen(store *content.Store, vol *content.Volume, articleIdx, width, height int) *AnsiArtScreen {
	article := &vol.Articles[articleIdx]
	s := &AnsiArtScreen{
		store:      store,
		volNum:     vol.Number,
		articleIdx: articleIdx,
		article:    article,
		volume:     vol,
		art:        article.Art,
		width:      width,
		height:     height,
	}

	credit := article.Author
	if s.art.Group != "" {
		credit += " / " + s.art.Group
	}
	first := fmt.Sprintf("Article #%02d  |  ANSI ART", article.Order)
	if !article.Date.IsZero() {
		first += "  |  " + article.Date.Format("2006-01-02")
	}
	meta := []string{
		first,
		fmt.Sprintf("Artist: %s", credit),
		fmt.Sprintf("%dx%d  |  %d baud", content.AnsiCols, len(s.art.Rows), ansiBaud),
	}
	s.header = components.RenderBoxFrame(fmt.Sprintf("VOL %d // %s", vol.Number, article.Title), meta, content.AnsiCols) + "\n\n"

	s.viewport = viewport.New(s.viewportWidth(), s.viewportHeight())
	s.viewport.Style = lipgloss.NewStyle()
	s.refresh()
	return s
}

func (s *AnsiArtScreen) viewportWidth() int {
	if s.width < content.AnsiCols {
		return s.width
	}
	return content.AnsiCols
}

func (s *AnsiArtScreen) viewportHeight() int {
	if s.height < 2 {
		return 1
	}
	return s.height - 1
}

func (s *AnsiArtScreen) tick() tea.Cmd {
	return tea.Tick(ansiTickRate, func(time.Time) tea.Msg { return ansiTickMsg{screen: s} })
}

func (s *AnsiArtScreen) Init() tea.Cmd {
	s.lastTick = time.Now()
	return s.tick()
}

// Resume restarts the tick chain after another screen (help, search) was on
// top and swallowed the ticks. The drawing picks up where it paused.
func (s *AnsiArtScreen) Resume() tea.Cmd {
	if s.finished {
		return nil
	}
	s.lastTick = time.Now()
	return s.tick()
}

func (s *AnsiArtScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
		s.viewport.Width = s.viewportWidth()
		s.viewport.Height = s.viewportHeight()
		s.refresh()
		return s, nil

	case ansiTickMsg:
		if msg.screen != s || s.finished {
			return s, nil
		}
		now := time.Now()
		s.elapsed += min(now.Sub(s.lastTick), ansiMaxStep)
		s.lastTick = now
		target := int(s.elapsed.Seconds() * ansiBaud / 10) // 8N1: 10 bits per byte
		s.cursor.Advance(s.art.Body, target, nil, nil)
		if s.cursor.Pos >= len(s.art.Body) {
			s.finished = true
		}
		s.refresh()
		if s.finished {
			return s, nil
		}
		return s, s.tick()

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc":
			return s, backCmd()
		case "?":
			return s, navigateCmd("help", 0, 0, "", "")
		case "/":
			return s, navigateCmd("search", 0, 0, "", "")
		case "p":
			if s.articleIdx > 0 {
				return s, replaceCmd("article", s.volNum, s.articleIdx-1)
			}
			return s, nil
		case "n":
			if s.articleIdx < len(s.volume.Articles)-1 {
				return s, replaceCmd("article", s.volNum, s.articleIdx+1)
			}
			return s, nil
		case "g":
			s.viewport.GotoTop()
			return s, nil
		case "G":
			s.viewport.GotoBottom()
			return s, nil
		}
	}

	var cmd tea.Cmd
	s.viewport, cmd = s.viewport.Update(msg)
	return s, cmd
}

// refresh rebuilds the viewport content from the cursor position, keeping
// the view pinned to the drawing edge if it was already there.
func (s *AnsiArtScreen) refresh() {
	if s.width < content.AnsiCols {
		s.viewport.SetContent(fmt.Sprintf(
			"This piece needs a terminal at least %d columns wide.\nYours is %d. Widen the window, or press q to go back.",
			content.AnsiCols, s.width))
		return
	}

	follow := s.viewport.AtBottom()

	rows := len(s.art.Rows)
	full := s.cursor.Row
	if s.finished || full > rows {
		full = rows
	}
	for len(s.done) < full {
		s.done = append(s.done, s.art.RenderRow(len(s.done), content.AnsiCols))
	}

	var b strings.Builder
	b.WriteString(s.header)
	b.WriteString(strings.Join(s.done, "\n"))
	if !s.finished && full < rows {
		if full > 0 {
			b.WriteString("\n")
		}
		b.WriteString(s.art.RenderRow(full, s.cursor.Col))
	}

	if s.finished {
		navStyle := lipgloss.NewStyle().Foreground(theme.Muted)
		cyanStyle := lipgloss.NewStyle().Foreground(theme.Cyan)
		b.WriteString("\n\n")
		if s.articleIdx > 0 {
			b.WriteString(navStyle.Render("  [p] prev  ") + cyanStyle.Render(s.volume.Articles[s.articleIdx-1].Title) + "\n")
		}
		if s.articleIdx < len(s.volume.Articles)-1 {
			b.WriteString(navStyle.Render("  [n] next  ") + cyanStyle.Render(s.volume.Articles[s.articleIdx+1].Title) + "\n")
		}
		b.WriteString(navStyle.Render("  [q] back to table of contents") + "\n")
	}

	s.viewport.SetContent(b.String())
	if follow {
		s.viewport.GotoBottom()
	}
}

func (s *AnsiArtScreen) View() string {
	return s.viewport.View()
}

func (s *AnsiArtScreen) StatusInfo() (string, *int) {
	vol := s.volNum
	return s.article.Title, &vol
}
