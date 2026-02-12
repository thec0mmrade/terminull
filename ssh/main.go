package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"syscall"
	"time"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/activeterm"
	"github.com/charmbracelet/wish/bubbletea"
	"github.com/charmbracelet/wish/logging"
	"github.com/charmbracelet/wish/ratelimiter"
	"golang.org/x/time/rate"

	"terminull-ssh/content"
	"terminull-ssh/ui"
)

// ansiEscapeRe matches ANSI escape sequences.
var ansiEscapeRe = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

// sanitizeUsername strips ANSI escapes, non-printable characters, and
// truncates to a safe length. Returns "guest" if the result is empty.
func sanitizeUsername(s string) string {
	s = ansiEscapeRe.ReplaceAllString(s, "")
	var b strings.Builder
	for _, r := range s {
		if r == ' ' || (unicode.IsPrint(r) && r != 0x7F) {
			b.WriteRune(r)
		}
	}
	s = strings.TrimSpace(b.String())
	if len(s) > 32 {
		s = s[:32]
	}
	if s == "" {
		return "guest"
	}
	return s
}

const maxUsernameLen = 64

// usernameGuard rejects sessions with excessively long usernames
// before they reach the bubbletea handler.
func usernameGuard() wish.Middleware {
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			if len(sess.User()) > maxUsernameLen {
				fmt.Fprintf(sess, "username too long (max %d bytes)\r\n", maxUsernameLen)
				return
			}
			next(sess)
		}
	}
}

// clamp returns v clamped to [lo, hi].
func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func main() {
	cfg := LoadConfig()

	// Load content at startup
	store := content.LoadStore(cfg.ContentDir)

	// Rate limiter: 1 conn/sec sustained, burst of 10, track up to 256 IPs
	limiter := ratelimiter.NewRateLimiter(rate.Every(time.Second), 10, 256)

	s, err := wish.NewServer(
		wish.WithAddress(fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)),
		wish.WithHostKeyPath(cfg.HostKeyPath),
		wish.WithIdleTimeout(10*time.Minute),
		wish.WithMaxTimeout(2*time.Hour),
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
				w = clamp(w, 40, 300)
				h = clamp(h, 10, 100)
				username := sanitizeUsername(sess.User())
				model := ui.NewApp(store, w, h, username, cfg.SiteURL)
				return model, []tea.ProgramOption{tea.WithAltScreen()}
			}),
			usernameGuard(),
			activeterm.Middleware(),
			logging.Middleware(),
			ratelimiter.Middleware(limiter),
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
