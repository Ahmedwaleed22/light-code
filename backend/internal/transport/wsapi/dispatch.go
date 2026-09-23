package wsapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"

	"project/backend/internal/services/files"
)

const (
	indexLimit  = 50000
	searchLimit = 500
)

type listResult struct {
	Entries []files.Entry `json:"entries"`
}

type indexResult struct {
	Paths     []string `json:"paths"`
	Truncated bool     `json:"truncated"`
}

type searchResult struct {
	Matches   []files.Match `json:"matches"`
	Truncated bool          `json:"truncated"`
}

var errBadRequest = errors.New("bad request")

func (h *Handler) dispatch(ctx context.Context, req request) (any, error) {
	decode := func(dst any) error {
		if err := json.Unmarshal(req.Args, dst); err != nil {
			return errBadRequest
		}
		return nil
	}
	switch req.Op {
	case "list":
		var args pathArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		entries, err := h.files.ListDir(args.Path)
		return listResult{Entries: entries}, err
	case "read":
		var args pathArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		return h.files.Read(args.Path)
	case "save":
		var args saveArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		doc, err := h.files.Save(ctx, args.Path, args.Content, args.Version)
		// The client already has the content; only return the new version.
		return files.Document{Path: doc.Path, Version: doc.Version}, err
	case "create", "mkdir", "delete":
		var args pathArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		op := map[string]func(context.Context, string) error{"create": h.files.Create, "mkdir": h.files.Mkdir, "delete": h.files.Delete}[req.Op]
		return struct{}{}, op(ctx, args.Path)
	case "rename":
		var args renameArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		return struct{}{}, h.files.Rename(ctx, args.From, args.To)
	case "index":
		paths, truncated, err := h.files.Index(ctx, indexLimit)
		return indexResult{Paths: paths, Truncated: truncated}, err
	case "search":
		var args searchArgs
		if err := decode(&args); err != nil {
			return nil, err
		}
		matches, truncated, err := h.files.Search(ctx, args.Query, searchLimit)
		return searchResult{Matches: matches, Truncated: truncated}, err
	}
	return nil, errBadRequest
}

func toWireError(err error) *wireError {
	codes := []struct {
		err  error
		code string
	}{
		{files.ErrInvalidPath, "invalid_path"},
		{files.ErrNotFound, "not_found"},
		{files.ErrTooLarge, "too_large"},
		{files.ErrBinary, "binary"},
		{files.ErrConflict, "conflict"},
		{files.ErrExists, "exists"},
		{files.ErrNotDir, "not_directory"},
		{errBadRequest, "bad_request"},
		{context.Canceled, "canceled"},
	}
	for _, c := range codes {
		if errors.Is(err, c.err) {
			return &wireError{Code: c.code, Message: err.Error()}
		}
	}
	log.Printf("ws: %v", err)
	return &wireError{Code: "internal", Message: "internal server error"}
}
