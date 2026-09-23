package config

import "os"

type Config struct {
	HTTPAddr      string
	WorkspaceRoot string
	FrontendDist  string
}

func Load() Config {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	root := os.Getenv("WORKSPACE_ROOT")
	if root == "" {
		root = "../data/workspace"
	}
	dist := os.Getenv("FRONTEND_DIST")
	if dist == "" {
		dist = "../frontend/dist"
	}
	return Config{HTTPAddr: addr, WorkspaceRoot: root, FrontendDist: dist}
}
