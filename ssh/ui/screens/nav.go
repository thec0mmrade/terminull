package screens

import (
	tea "github.com/charmbracelet/bubbletea"
	"terminull-ssh/ui/types"
)

// navigateCmd returns a command that emits a NavigateMsg.
func navigateCmd(screen string, volume, article int, pageSlug, query string) tea.Cmd {
	return func() tea.Msg {
		return types.NavigateMsg{
			Screen:   screen,
			Volume:   volume,
			Article:  article,
			PageSlug: pageSlug,
			Query:    query,
		}
	}
}

// backCmd returns a command that emits a BackMsg.
func backCmd() tea.Cmd {
	return func() tea.Msg {
		return types.BackMsg{}
	}
}

// replaceCmd returns a command that emits a ReplaceMsg.
func replaceCmd(screen string, volume, article int) tea.Cmd {
	return func() tea.Msg {
		return types.ReplaceMsg{
			Screen:  screen,
			Volume:  volume,
			Article: article,
		}
	}
}
