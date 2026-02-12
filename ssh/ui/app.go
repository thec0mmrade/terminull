package ui

import (
	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/screens"
	"terminull-ssh/ui/types"

	tea "github.com/charmbracelet/bubbletea"
)

const maxStackDepth = 20

// AppModel is the root Bubble Tea model managing a screen stack.
type AppModel struct {
	store    *content.Store
	siteURL  string
	username string
	width    int
	height   int
	stack    []types.Screen
}

// NewApp creates the root application model.
func NewApp(store *content.Store, width, height int, username, siteURL string) *AppModel {
	if width < 40 {
		width = 80
	}
	if height < 10 {
		height = 24
	}
	if username == "" {
		username = "guest"
	}

	app := &AppModel{
		store:    store,
		siteURL:  siteURL,
		username: username,
		width:    width,
		height:   height,
	}

	// Start with home screen
	home := screens.NewHomeScreen(store, width, height, username, siteURL)
	app.stack = []types.Screen{home}

	return app
}

func (a *AppModel) Init() tea.Cmd {
	if len(a.stack) > 0 {
		return a.stack[len(a.stack)-1].Init()
	}
	return nil
}

func (a *AppModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		// Propagate to all screens
		var cmds []tea.Cmd
		for i, s := range a.stack {
			updated, cmd := s.Update(msg)
			a.stack[i] = updated.(types.Screen)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}
		return a, tea.Batch(cmds...)

	case types.NavigateMsg:
		return a.navigate(msg)

	case types.ReplaceMsg:
		return a.replace(msg)

	case types.BackMsg:
		if len(a.stack) > 1 {
			a.stack = a.stack[:len(a.stack)-1]
			return a, nil
		}
		return a, tea.Quit

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return a, tea.Quit
		}
	}

	// Forward to active screen
	if len(a.stack) > 0 {
		active := a.stack[len(a.stack)-1]
		updated, cmd := active.Update(msg)
		a.stack[len(a.stack)-1] = updated.(types.Screen)
		return a, cmd
	}

	return a, nil
}

func (a *AppModel) View() string {
	if len(a.stack) == 0 {
		return ""
	}

	active := a.stack[len(a.stack)-1]
	page, vol := active.StatusInfo()

	screenContent := active.View()
	statusBar := components.RenderStatusBar(page, vol, a.width)

	return screenContent + "\n" + statusBar
}

func (a *AppModel) navigate(msg types.NavigateMsg) (*AppModel, tea.Cmd) {
	var screen types.Screen

	contentWidth := a.width
	if contentWidth > 78 {
		contentWidth = 78
	}
	contentHeight := a.height - 1

	switch msg.Screen {
	case "volume":
		screen = screens.NewVolumeScreen(a.store, msg.Volume, contentWidth, contentHeight)
	case "article":
		screen = screens.NewArticleScreen(a.store, msg.Volume, msg.Article, contentWidth, contentHeight, a.siteURL)
	case "page":
		screen = screens.NewPageScreen(a.store, msg.PageSlug, contentWidth, contentHeight)
	case "help":
		screen = screens.NewHelpScreen(contentWidth, contentHeight)
	case "search":
		screen = screens.NewSearchScreen(a.store, contentWidth, contentHeight, msg.Query)
	default:
		return a, nil
	}

	if len(a.stack) >= maxStackDepth {
		// At max depth — replace top screen instead of pushing
		a.stack[len(a.stack)-1] = screen
	} else {
		a.stack = append(a.stack, screen)
	}
	return a, screen.Init()
}

func (a *AppModel) replace(msg types.ReplaceMsg) (*AppModel, tea.Cmd) {
	contentWidth := a.width
	if contentWidth > 78 {
		contentWidth = 78
	}
	contentHeight := a.height - 1

	switch msg.Screen {
	case "article":
		screen := screens.NewArticleScreen(a.store, msg.Volume, msg.Article, contentWidth, contentHeight, a.siteURL)
		if len(a.stack) > 0 {
			a.stack[len(a.stack)-1] = screen
		}
		return a, screen.Init()
	}

	return a, nil
}
