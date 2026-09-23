// Package wsapi exposes workspace operations over a single WebSocket per browser tab.
//
// Client → server: {"id": 1, "op": "read", "args": {...}}
// Server → client: {"id": 1, "result": ...} or {"id": 1, "error": {"code": "...", "message": "..."}}
// Server push:     {"event": "files.saved", "data": {...}}
package wsapi

import "encoding/json"

type request struct {
	ID   uint64          `json:"id"`
	Op   string          `json:"op"`
	Args json.RawMessage `json:"args"`
}

type response struct {
	ID     uint64     `json:"id"`
	Result any        `json:"result,omitempty"`
	Error  *wireError `json:"error,omitempty"`
}

type push struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type wireError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type pathArgs struct {
	Path string `json:"path"`
}

type saveArgs struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Version string `json:"version"`
}

type renameArgs struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type searchArgs struct {
	Query string `json:"query"`
}
