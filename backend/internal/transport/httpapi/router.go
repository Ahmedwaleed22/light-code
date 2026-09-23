package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"project/backend/internal/services/files"
	"project/backend/internal/services/health"
)

func NewRouter(healthService *health.Service, fileService *files.Service, frontendDist string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": healthService.Status()})
	})
	mux.HandleFunc("GET /api/files", func(w http.ResponseWriter, _ *http.Request) {
		entries, err := fileService.List()
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, entries)
	})
	mux.HandleFunc("POST /api/files", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Path string `json:"path"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&input); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}
		if err := fileService.Create(input.Path); err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"path": input.Path})
	})
	mux.HandleFunc("GET /api/file", func(w http.ResponseWriter, r *http.Request) {
		doc, err := fileService.Read(r.URL.Query().Get("path"))
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, doc)
	})
	mux.HandleFunc("PUT /api/file", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Path    string `json:"path"`
			Content string `json:"content"`
			Version string `json:"version"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, files.MaxFileSize+4096)).Decode(&input); err != nil {
			http.Error(w, "invalid JSON or file too large", http.StatusBadRequest)
			return
		}
		doc, err := fileService.Save(r.Context(), input.Path, input.Content, input.Version)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, doc)
	})
	mux.Handle("/", http.FileServer(http.Dir(frontendDist)))
	return mux
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, files.ErrInvalidPath), errors.Is(err, files.ErrTooLarge), errors.Is(err, files.ErrBinary):
		status = http.StatusBadRequest
	case errors.Is(err, files.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, files.ErrConflict), errors.Is(err, files.ErrExists):
		status = http.StatusConflict
	}
	if status == http.StatusInternalServerError {
		http.Error(w, "internal server error", status)
		return
	}
	http.Error(w, err.Error(), status)
}
