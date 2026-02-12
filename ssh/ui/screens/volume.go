package screens

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"terminull-ssh/content"
	"terminull-ssh/ui/components"
	"terminull-ssh/ui/theme"
)

// VolumeScreen shows the table of contents for a volume.
type VolumeScreen struct {
	store   *content.Store
	volNum  int
	volume  *content.Volume
	width   int
	height  int
	cursor  int
}

func NewVolumeScreen(store *content.Store, volNum, width, height int) *VolumeScreen {
	var vol *content.Volume
	for i := range store.Volumes {
		if store.Volumes[i].Number == volNum {
			vol = &store.Volumes[i]
			break
		}
	}
	return &VolumeScreen{
		store:  store,
		volNum: volNum,
		volume: vol,
		width:  width,
		height: height,
	}
}

func (v *VolumeScreen) Init() tea.Cmd { return nil }

func (v *VolumeScreen) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		v.width = msg.Width
		v.height = msg.Height
		return v, nil

	case tea.KeyMsg:
		maxIdx := 0
		if v.volume != nil {
			maxIdx = len(v.volume.Articles) - 1
		}

		switch msg.String() {
		case "j", "down":
			if v.cursor < maxIdx {
				v.cursor++
			}
			return v, nil
		case "k", "up":
			if v.cursor > 0 {
				v.cursor--
			}
			return v, nil
		case "enter":
			if v.volume != nil && v.cursor < len(v.volume.Articles) {
				return v, navigateCmd("article", v.volNum, v.cursor, "", "")
			}
			return v, nil
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			idx := int(msg.String()[0]-'0') - 1
			if v.volume != nil && idx < len(v.volume.Articles) {
				v.cursor = idx
				return v, navigateCmd("article", v.volNum, idx, "", "")
			}
			return v, nil
		case "0":
			idx := 9
			if v.volume != nil && idx < len(v.volume.Articles) {
				v.cursor = idx
				return v, navigateCmd("article", v.volNum, idx, "", "")
			}
			return v, nil
		case "q", "esc":
			return v, backCmd()
		case "?":
			return v, navigateCmd("help", 0, 0, "", "")
		case "/":
			return v, navigateCmd("search", 0, 0, "", "")
		}
	}

	return v, nil
}

func (v *VolumeScreen) View() string {
	w := v.width
	if w > 78 {
		w = 78
	}

	var b strings.Builder

	// Title
	titleStyle := lipgloss.NewStyle().Foreground(theme.Gold).Bold(true)
	b.WriteString(titleStyle.Render(fmt.Sprintf("VOLUME %d -- TABLE OF CONTENTS", v.volNum)))
	b.WriteString("\n")
	b.WriteString(components.RenderDivider(w))
	b.WriteString("\n\n")

	if v.volume == nil || len(v.volume.Articles) == 0 {
		b.WriteString(lipgloss.NewStyle().Foreground(theme.Secondary).Render("  No articles in this volume."))
		b.WriteString("\n")
		return b.String()
	}

	// Table header
	headerStyle := lipgloss.NewStyle().Foreground(theme.Muted)
	b.WriteString(headerStyle.Render(fmt.Sprintf("  %-4s%-38s%-20s%s", "#", "TITLE", "AUTHOR", "CATEGORY")))
	b.WriteString("\n")
	b.WriteString(headerStyle.Render("  " + strings.Repeat("─", 4) + strings.Repeat("─", 38) + strings.Repeat("─", 20) + strings.Repeat("─", 14)))
	b.WriteString("\n")

	// Article rows
	for i, article := range v.volume.Articles {
		num := fmt.Sprintf("%02d", article.Order)
		title := truncate(article.Title, 36)
		author := truncate(article.Author, 18)
		cat := article.Category

		catColor := theme.CategoryColor(cat)

		if i == v.cursor {
			// Active row
			cursor := lipgloss.NewStyle().Foreground(theme.Green).Render("▸ ")
			numStyle := lipgloss.NewStyle().Foreground(theme.GreenBright).Bold(true)
			titleStyle := lipgloss.NewStyle().Foreground(theme.GreenBright)
			authorStyle := lipgloss.NewStyle().Foreground(theme.Green)
			catStyle := lipgloss.NewStyle().Foreground(catColor).Bold(true)

			b.WriteString(cursor +
				numStyle.Render(fmt.Sprintf("%-4s", num)) +
				titleStyle.Render(fmt.Sprintf("%-38s", title)) +
				authorStyle.Render(fmt.Sprintf("%-20s", author)) +
				catStyle.Render(cat))
		} else {
			numStyle := lipgloss.NewStyle().Foreground(theme.Green)
			titleStyle := lipgloss.NewStyle().Foreground(theme.Text)
			authorStyle := lipgloss.NewStyle().Foreground(theme.Secondary)
			catStyle := lipgloss.NewStyle().Foreground(catColor)

			b.WriteString("  " +
				numStyle.Render(fmt.Sprintf("%-4s", num)) +
				titleStyle.Render(fmt.Sprintf("%-38s", title)) +
				authorStyle.Render(fmt.Sprintf("%-20s", author)) +
				catStyle.Render(cat))
		}
		b.WriteString("\n")
	}

	b.WriteString("\n")
	hintStyle := lipgloss.NewStyle().Foreground(theme.Muted)
	b.WriteString(hintStyle.Render("  Enter to read  |  j/k navigate  |  q back"))
	b.WriteString("\n")

	return b.String()
}

func (v *VolumeScreen) StatusInfo() (string, *int) {
	vol := v.volNum
	return "TOC", &vol
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max-1] + "…"
	}
	return s
}
