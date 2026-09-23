package httpapi

import (
	"encoding/json"
	"net/http"

	"project/backend/internal/services/health"
)

// NewRouter serves health checks, the realtime socket, and the built frontend.
func NewRouter(healthService *health.Service, socket http.Handler, frontendDist string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": healthService.Status()})
	})
	mux.Handle("GET /api/ws", socket)
	mux.Handle("/", newStatic(frontendDist))
	return mux
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
