package main

import (
	"flag"
	"os"
	"strconv"
)

// Config holds runtime configuration from env vars and flags.
type Config struct {
	Host        string
	Port        int
	ContentDir  string
	VolumesDir  string
	SiteURL     string
	HostKeyPath string
	MaxSessions int
}

// LoadConfig reads env vars with flag overrides.
func LoadConfig() Config {
	cfg := Config{
		Host:        envOr("TERMINULL_HOST", "0.0.0.0"),
		Port:        envInt("TERMINULL_PORT", 2222),
		ContentDir:  envOr("TERMINULL_CONTENT_DIR", "../src/content"),
		VolumesDir:  envOr("TERMINULL_VOLUMES_DIR", "../src/content/volumes"),
		SiteURL:     envOr("TERMINULL_SITE_URL", "https://terminull.local"),
		HostKeyPath: envOr("TERMINULL_HOST_KEY", "./ssh_host_ed25519_key"),
		MaxSessions: envInt("TERMINULL_MAX_SESSIONS", 100),
	}

	flag.StringVar(&cfg.Host, "host", cfg.Host, "bind host")
	flag.IntVar(&cfg.Port, "port", cfg.Port, "bind port")
	flag.StringVar(&cfg.ContentDir, "content-dir", cfg.ContentDir, "path to content directory")
	flag.StringVar(&cfg.VolumesDir, "volumes-dir", cfg.VolumesDir, "path to volumes directory")
	flag.StringVar(&cfg.SiteURL, "site-url", cfg.SiteURL, "public site URL")
	flag.StringVar(&cfg.HostKeyPath, "host-key", cfg.HostKeyPath, "SSH host key path")
	flag.IntVar(&cfg.MaxSessions, "max-sessions", cfg.MaxSessions, "maximum concurrent sessions")
	flag.Parse()

	if cfg.MaxSessions < 1 {
		cfg.MaxSessions = 100
	}

	return cfg
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
