package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/activeterm"
	"github.com/charmbracelet/wish/bubbletea"
	"github.com/charmbracelet/wish/logging"

	"terminull-ssh/content"
	"terminull-ssh/ui"
)

func main() {
	cfg := LoadConfig()

	// Load content at startup
	store := content.LoadStore(cfg.ContentDir)

	s, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)),
		wish.WithHostKeyPath(cfg.HostKeyPath),
		wish.WithMiddleware(
			bubbletea.Middleware(func(sess ssh.Session) (tea.Model, []tea.ProgramOption) {
				pty, _, _ := sess.Pty()
				w := pty.Window.Width
				h := pty.Window.Height
				if w == 0 {
					w = 80
				}
				if h == 0 {
					h = 24
				}
				username := sess.User()
				model := ui.NewApp(store, w, h, username, cfg.SiteURL)
				return model, []tea.ProgramOption{tea.WithAltScreen()}
			}),
			activeterm.Middleware(),
			logging.Middleware(),
		),
	)
	if err != nil {
		log.Fatalf("could not create SSH server: %v", err)
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	log.Printf("Starting terminull SSH BBS on %s:%d", cfg.Host, cfg.Port)
	go func() {
		if err := s.ListenAndServe(); err != nil {
			log.Fatalf("SSH server error: %v", err)
		}
	}()

	<-done
	log.Println("Shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := s.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}
}
