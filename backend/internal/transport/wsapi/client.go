package wsapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/coder/websocket"
)

const (
	pingInterval   = 25 * time.Second
	writeTimeout   = 10 * time.Second
	sendBuffer     = 64
	maxQueuedBytes = 16 << 20 // Bound slow consumers by bytes as well as message count.
)

// client owns one connection's outgoing queue, byte budget, and heartbeat.
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

func (c *client) writeLoop(ctx context.Context, cancel context.CancelFunc, conn *websocket.Conn) {
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

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}
