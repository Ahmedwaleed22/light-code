package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"project/backend/internal/config"
	"project/backend/internal/events/memory"
	"project/backend/internal/services/files"
	"project/backend/internal/services/health"
	"project/backend/internal/transport/httpapi"
	"project/backend/internal/transport/wsapi"
)

// defaultMemoryLimit is a soft GC target that keeps the server's footprint small after large
// file transfers. Operators can override it with the standard GOMEMLIMIT variable.
const defaultMemoryLimit = 32 << 20

func main() {
	if os.Getenv("GOMEMLIMIT") == "" {
		debug.SetMemoryLimit(defaultMemoryLimit)
	}
	cfg := config.Load()
	bus := memory.New()
	fileService, err := files.New(cfg.WorkspaceRoot, bus)
	if err != nil {
		log.Fatal(err)
	}
	socket := wsapi.New(fileService, bus, cfg.AllowedOrigins)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpapi.NewRouter(health.New(), socket, cfg.FrontendDist),
		ReadHeaderTimeout: 5 * time.Second,
		// Cancelling the base context on shutdown also closes hijacked WebSocket connections.
		BaseContext: func(net.Listener) context.Context { return ctx },
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()

	log.Printf("API listening on %s", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
