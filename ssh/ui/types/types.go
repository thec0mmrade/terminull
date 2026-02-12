package types

import tea "github.com/charmbracelet/bubbletea"

// Screen is implemented by all screen models.
type Screen interface {
	tea.Model
	StatusInfo() (page string, volume *int)
}

// NavigateMsg pushes a new screen onto the stack.
type NavigateMsg struct {
	Screen   string // "home", "volume", "article", "page", "help", "search"
	Volume   int
	Article  int    // index in volume
	PageSlug string // for static pages
	Query    string // for search
}

// BackMsg pops the current screen.
type BackMsg struct{}

// ReplaceMsg replaces the top screen (for prev/next article).
type ReplaceMsg struct {
	Screen  string
	Volume  int
	Article int
}
