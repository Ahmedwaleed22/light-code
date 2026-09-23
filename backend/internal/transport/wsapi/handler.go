package wsapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"

	"project/backend/internal/events"
	"project/backend/internal/services/files"
)

const (
	pingInterval   = 25 * time.Second
	writeTimeout   = 10 * time.Second
	sendBuffer     = 64
	maxConcurrency = 4        // Parallel requests per connection; keeps one tab from starving others.
	maxFileWork    = 8        // Includes disk waits; a little I/O parallelism keeps saves responsive.
	maxQueuedBytes = 16 << 20 // Bound slow consumers by bytes as well as message count.
	// JSON escaping can inflate content; allow headroom above the file limit.
	readLimit = 6*files.MaxFileSize + 64<<10
)

type Handler struct {
	files          *files.Service
	originPatterns []string

	mu      sync.RWMutex
	clients map[string]*client
	work    chan struct{} // Shared across connections to bound expensive file operations.
}

type client struct {
	id   string
	send chan []byte
	// closed is signalled when the send buffer overflows so the socket is dropped.
	closed chan struct{}
	once   sync.Once
	mu     sync.Mutex
	queued int
}

func (c *client) enqueue(message []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.queued+len(message) > maxQueuedBytes {
		c.once.Do(func() { close(c.closed) })
		return
	}
	select {
	case c.send <- message:
		c.queued += len(message)
	default:
		c.once.Do(func() { close(c.closed) }) // Slow consumer: disconnect, the client resyncs on reconnect.
	}
}

// New wires the handler to the bus so file changes are pushed to every other connected tab.
func New(fileService *files.Service, bus events.Bus, originPatterns []string) *Handler {
	h := &Handler{files: fileService, originPatterns: originPatterns, clients: map[string]*client{}, work: make(chan struct{}, maxFileWork)}
	for _, topic := range files.Topics {
		bus.Subscribe(topic, h.broadcast)
	}
	return h
}

func (h *Handler) broadcast(_ context.Context, event events.Event) error {
	message, err := json.Marshal(push{Event: event.Topic, Data: event.Data})
	if err != nil {
		return err
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id, c := range h.clients {
		if id != event.Origin {
			c.enqueue(message)
		}
	}
	return nil
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns:  h.originPatterns,
		CompressionMode: websocket.CompressionNoContextTakeover,
	})
	if err != nil {
		return
	}
	conn.SetReadLimit(readLimit)
	c := &client{id: newID(), send: make(chan []byte, sendBuffer), closed: make(chan struct{})}
	h.mu.Lock()
	h.clients[c.id] = c
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c.id)
		h.mu.Unlock()
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	go h.writeLoop(ctx, cancel, conn, c)
	err = h.readLoop(events.WithOrigin(ctx, c.id), conn, c)
	status := websocket.CloseStatus(err)
	if status == -1 && !errors.Is(err, context.Canceled) {
		log.Printf("ws %s: %v", c.id, err)
	}
	conn.Close(websocket.StatusNormalClosure, "")
}

func (h *Handler) readLoop(ctx context.Context, conn *websocket.Conn, c *client) error {
	slots := make(chan struct{}, maxConcurrency)
	var mu sync.Mutex
	active := make(map[uint64]context.CancelFunc)
	defer func() {
		mu.Lock()
		defer mu.Unlock()
		for _, cancel := range active {
			cancel()
		}
	}()
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return err
		}
		var req request
		if err := json.Unmarshal(data, &req); err != nil {
			return err
		}
		if req.Op == "ping" {
			c.enqueue(mustMarshal(response{ID: req.ID, Result: "pong"}))
			continue
		}
		if req.Op == "cancel" {
			var args struct {
				ID uint64 `json:"id"`
			}
			if json.Unmarshal(req.Args, &args) == nil {
				mu.Lock()
				if cancel := active[args.ID]; cancel != nil {
					cancel()
				}
				mu.Unlock()
			}
			continue
		}
		mu.Lock()
		_, duplicate := active[req.ID]
		mu.Unlock()
		if duplicate || req.ID == 0 {
			return errBadRequest
		}
		select {
		case slots <- struct{}{}:
		default:
			// Keep reading so a busy connection can still cancel requests and answer pings.
			c.enqueue(mustMarshal(response{ID: req.ID, Error: &wireError{Code: "busy", Message: "too many concurrent requests"}}))
			continue
		}
		requestCtx, cancel := context.WithCancel(ctx)
		mu.Lock()
		active[req.ID] = cancel
		mu.Unlock()
		go func() {
			result, err := h.run(requestCtx, req)
			mu.Lock()
			delete(active, req.ID)
			mu.Unlock()
			cancel()
			<-slots
			resp := response{ID: req.ID, Result: result}
			if err != nil {
				resp = response{ID: req.ID, Error: toWireError(err)}
			}
			c.enqueue(mustMarshal(resp))
		}()
	}
}

func (h *Handler) run(ctx context.Context, req request) (any, error) {
	// Search has its own single-worker gate. Waiting searches must not occupy all
	// file-operation slots and delay interactive reads or saves.
	if req.Op == "search" {
		return h.dispatch(ctx, req)
	}
	select {
	case h.work <- struct{}{}:
		defer func() { <-h.work }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return h.dispatch(ctx, req)
}

func (h *Handler) writeLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn, c *client) {
	defer cancel()
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		case message := <-c.send:
			writeCtx, done := context.WithTimeout(ctx, writeTimeout)
			err := conn.Write(writeCtx, websocket.MessageText, message)
			done()
			c.mu.Lock()
			c.queued -= len(message)
			c.mu.Unlock()
			if err != nil {
				return
			}
		case <-ticker.C:
			// Detects half-open connections (e.g. a laptop that slept) so resources are released.
			pingCtx, done := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pingCtx)
			done()
			if err != nil {
				return
			}
		}
	}
}

func mustMarshal(v any) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		data, _ = json.Marshal(response{Error: &wireError{Code: "internal", Message: "encode failed"}})
	}
	return data
}

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
