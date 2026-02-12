package screens

import (
	"strings"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// HelpScreen shows keyboard navigation reference.
type HelpScreen struct {
	viewport viewport.Model
	width    int
	height   int
}

func NewHelpScreen(width, height int) *HelpScreen {
	h := &HelpScreen{
		width:  width,
		height: height,
	}
	h.initViewport()
	return h
}

func (h *HelpScreen) initViewport() {
	h.viewport = viewport.New(h.contentWidth(), h.viewportHeight())
	h.viewport.Style = lipgloss.NewStyle()
	h.renderContent()
}

func (h *HelpScreen) viewportHeight() int {
	vh := h.height - 1
	if vh < 1 {
		vh = 1
	}
	return vh
}

func (h *HelpScreen) Init() tea.Cmd { return nil }

func (h *HelpScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h.width = msg.Width
		h.height = msg.Height
		h.viewport.Width = h.contentWidth()
		h.viewport.Height = h.viewportHeight()
		return h, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "?":
			return h, backCmd()
		}
	}

	var cmd tea.Cmd
	h.viewport, cmd = h.viewport.Update(msg)
	return h, cmd
}

func (h *HelpScreen) contentWidth() int {
	w := h.width
	if w > 78 {
		w = 78
	}
	return w
}

func (h *HelpScreen) renderContent() {
	w := h.contentWidth()

	keyStyle := lipgloss.NewStyle().Foreground(theme.Green).Bold(true)
	descStyle := lipgloss.NewStyle().Foreground(theme.Text)
	sectionStyle := lipgloss.NewStyle().Foreground(theme.Cyan).Bold(true)

	formatKey := func(key, desc string) string {
		padded := key + strings.Repeat(" ", 12)
		return "  " + keyStyle.Render(padded[:12]) + descStyle.Render(desc)
	}

	var lines []string

	lines = append(lines, sectionStyle.Render("NAVIGATION"))
	lines = append(lines, "")
	lines = append(lines, formatKey("j / ↓", "Move down"))
	lines = append(lines, formatKey("k / ↑", "Move up"))
	lines = append(lines, formatKey("Enter", "Select item"))
	lines = append(lines, formatKey("Esc / q", "Go back"))
	lines = append(lines, formatKey("1-9", "Quick jump to item"))
	lines = append(lines, "")
	lines = append(lines, sectionStyle.Render("ARTICLE READER"))
	lines = append(lines, "")
	lines = append(lines, formatKey("j / ↓", "Scroll down"))
	lines = append(lines, formatKey("k / ↑", "Scroll up"))
	lines = append(lines, formatKey("d", "Half page down"))
	lines = append(lines, formatKey("u", "Half page up"))
	lines = append(lines, formatKey("g", "Go to top"))
	lines = append(lines, formatKey("G", "Go to bottom"))
	lines = append(lines, formatKey("p", "Previous article"))
	lines = append(lines, formatKey("n", "Next article"))
	lines = append(lines, "")
	lines = append(lines, sectionStyle.Render("GLOBAL"))
	lines = append(lines, "")
	lines = append(lines, formatKey("?", "Toggle help"))
	lines = append(lines, formatKey("/", "Open search"))
	lines = append(lines, formatKey("Ctrl+C", "Quit / disconnect"))

	content := components.RenderBoxFrame("KEYBOARD REFERENCE", lines, w)
	h.viewport.SetContent(content)
}

func (h *HelpScreen) View() string {
	return h.viewport.View()
}

func (h *HelpScreen) StatusInfo() (string, *int) {
	return "HELP", nil
}
