package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/ssh"
	"github.com/charmbracelet/wish"
	"github.com/charmbracelet/wish/activeterm"
	"github.com/charmbracelet/wish/bubbletea"
	"github.com/charmbracelet/wish/ratelimiter"
	"github.com/muesli/termenv"
	"golang.org/x/time/rate"

	"terminull-ssh/content"
	"terminull-ssh/ui"
	"terminull-ssh/ui/types"
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
	if r := []rune(s); len(r) > 32 {
		s = strings.TrimSpace(string(r[:32]))
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
				log.Printf("rejecting %d-byte username from %s", len(sess.User()), sess.RemoteAddr())
				fmt.Fprintf(sess, "username too long (max %d bytes)\r\n", maxUsernameLen)
				return
			}
			next(sess)
		}
	}
}

// connLog logs connects and disconnects. Username, TERM and client version
// are client-controlled, so they are written with %q: control characters and
// newlines are escaped and each event stays on one line.
func connLog() wish.Middleware {
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			start := time.Now()
			pty, _, _ := sess.Pty()
			log.Printf("connect user=%q remote=%s term=%q size=%dx%d client=%q",
				sess.User(), sess.RemoteAddr(), pty.Term,
				pty.Window.Width, pty.Window.Height, sess.Context().ClientVersion())
			next(sess)
			log.Printf("disconnect remote=%s duration=%s",
				sess.RemoteAddr(), time.Since(start).Round(time.Millisecond))
		}
	}
}

// sessionLimit caps the number of concurrent sessions. The rate limiter is
// per-IP, so without this a distributed client could hold sessions open
// until the server runs out of memory.
func sessionLimit(max int) wish.Middleware {
	var active atomic.Int64
	return func(next ssh.Handler) ssh.Handler {
		return func(sess ssh.Session) {
			if active.Add(1) > int64(max) {
				active.Add(-1)
				log.Printf("session limit (%d) reached, rejecting %s", max, sess.RemoteAddr())
				fmt.Fprint(sess, "server full, try again later\r\n")
				return
			}
			defer active.Add(-1)
			next(sess)
		}
	}
}

func main() {
	// Force ANSI256 color profile. The server process has no TTY, so
	// lipgloss detects Ascii profile and drops all color codes. SSH
	// clients connecting will support 256 colors.
	lipgloss.SetColorProfile(termenv.ANSI256)
	lipgloss.SetHasDarkBackground(true)

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
				w, h = types.ClampSize(w, h)
				username := sanitizeUsername(sess.User())
				model := ui.NewApp(store, w, h, username, cfg.SiteURL)
				return model, []tea.ProgramOption{tea.WithAltScreen()}
			}),
			activeterm.Middleware(),
			connLog(),
			// Middleware listed later runs earlier: rate limit, then
			// session cap, then the username guard, then logging.
			usernameGuard(),
			sessionLimit(cfg.MaxSessions),
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
