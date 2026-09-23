package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"project/backend/internal/config"
	"project/backend/internal/events/memory"
	"project/backend/internal/services/files"
	"project/backend/internal/services/health"
	"project/backend/internal/transport/httpapi"
)

func main() {
	cfg := config.Load()
	fileService, err := files.New(cfg.WorkspaceRoot, memory.New())
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpapi.NewRouter(health.New(), fileService, cfg.FrontendDist),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
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
