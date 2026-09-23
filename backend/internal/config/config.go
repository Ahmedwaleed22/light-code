package config

import (
	"os"
	"strings"
)

type Config struct {
	HTTPAddr      string
	WorkspaceRoot string
	FrontendDist  string
	// AllowedOrigins lists extra host patterns (e.g. "*.example.com") allowed to open the socket.
	// Same-origin connections are always allowed.
	AllowedOrigins []string
}

func Load() Config {
	return Config{
		HTTPAddr:       env("HTTP_ADDR", "127.0.0.1:8080"),
		WorkspaceRoot:  env("WORKSPACE_ROOT", "../data/workspace"),
		FrontendDist:   env("FRONTEND_DIST", "../frontend/dist"),
		AllowedOrigins: list(os.Getenv("ALLOWED_ORIGINS")),
	}
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func list(value string) []string {
	var items []string
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}
