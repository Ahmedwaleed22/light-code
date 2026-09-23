package wsapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"project/backend/internal/events/memory"
	"project/backend/internal/services/files"
)

type message struct {
	ID     uint64          `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  *wireError      `json:"error"`
	Event  string          `json:"event"`
	Data   json.RawMessage `json:"data"`
}

func dial(t *testing.T, ctx context.Context, url string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.Dial(ctx, strings.Replace(url, "http", "ws", 1), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return conn
}

func call(t *testing.T, ctx context.Context, conn *websocket.Conn, id uint64, op string, args any) message {
	t.Helper()
	raw, _ := json.Marshal(args)
	payload, _ := json.Marshal(request{ID: id, Op: op, Args: raw})
	if err := conn.Write(ctx, websocket.MessageText, payload); err != nil {
		t.Fatal(err)
	}
	return next(t, ctx, conn)
}

func next(t *testing.T, ctx context.Context, conn *websocket.Conn) message {
	t.Helper()
	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var m message
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestSocketRequestsAndPush(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	bus := memory.New()
	svc, err := files.New(t.TempDir(), bus)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(svc, bus, nil))
	defer server.Close()
	editor, watcher := dial(t, ctx, server.URL), dial(t, ctx, server.URL)

	if m := call(t, ctx, editor, 1, "ping", nil); string(m.Result) != `"pong"` {
		t.Fatalf("ping = %+v", m)
	}
	if m := call(t, ctx, editor, 2, "create", pathArgs{Path: "a.txt"}); m.Error != nil {
		t.Fatalf("create = %+v", m.Error)
	}
	if m := next(t, ctx, watcher); m.Event != files.TopicCreated {
		t.Fatalf("watcher got %+v", m)
	}
	read := call(t, ctx, editor, 3, "read", pathArgs{Path: "a.txt"})
	var doc files.Document
	_ = json.Unmarshal(read.Result, &doc)
	saved := call(t, ctx, editor, 4, "save", saveArgs{Path: "a.txt", Content: "hi", Version: doc.Version})
	if saved.Error != nil || saved.ID != 4 {
		t.Fatalf("save = %+v", saved)
	}
	if m := next(t, ctx, watcher); m.Event != files.TopicSaved || !strings.Contains(string(m.Data), `"a.txt"`) {
		t.Fatalf("watcher got %+v", m)
	}
	if m := call(t, ctx, editor, 5, "save", saveArgs{Path: "a.txt", Content: "other", Version: doc.Version}); m.Error == nil || m.Error.Code != "conflict" {
		t.Fatalf("stale save = %+v", m)
	}
	if m := call(t, ctx, editor, 6, "read", pathArgs{Path: "../x"}); m.Error == nil || m.Error.Code != "invalid_path" {
		t.Fatalf("traversal = %+v", m)
	}
	// The editor must not receive an echo of its own save: its next message is the ping reply.
	if m := call(t, ctx, editor, 7, "ping", nil); m.ID != 7 {
		t.Fatalf("unexpected echo %+v", m)
	}
}

func TestCancelAndPingWhileBusy(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	bus := memory.New()
	svc, err := files.New(t.TempDir(), bus)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(svc, bus, nil)
	// Occupy the shared workers so socket requests remain queued until canceled.
	for i := 0; i < maxFileWork; i++ {
		handler.work <- struct{}{}
	}
	server := httptest.NewServer(handler)
	defer server.Close()
	conn := dial(t, ctx, server.URL)
	send := func(payload string) {
		t.Helper()
		if err := conn.Write(ctx, websocket.MessageText, []byte(payload)); err != nil {
			t.Fatal(err)
		}
	}
	for i := 1; i <= maxConcurrency; i++ {
		payload, _ := json.Marshal(request{ID: uint64(i), Op: "read", Args: json.RawMessage(`{"path":"a.txt"}`)})
		send(string(payload))
	}
	send(`{"id":10,"op":"read","args":{"path":"a.txt"}}`)
	if m := next(t, ctx, conn); m.ID != 10 || m.Error == nil || m.Error.Code != "busy" {
		t.Fatalf("overload = %+v", m)
	}
	if m := call(t, ctx, conn, 11, "ping", nil); m.ID != 11 || string(m.Result) != `"pong"` {
		t.Fatalf("busy ping = %+v", m)
	}
	send(`{"id":0,"op":"cancel","args":{"id":1}}`)
	if m := next(t, ctx, conn); m.ID != 1 || m.Error == nil || m.Error.Code != "canceled" {
		t.Fatalf("cancel = %+v", m)
	}
	if wire := toWireError(context.Canceled); wire.Code != "canceled" {
		t.Fatal(wire)
	}
}

func TestSlowConsumerByteBudget(t *testing.T) {
	c := &client{send: make(chan []byte, sendBuffer), closed: make(chan struct{})}
	message := make([]byte, maxQueuedBytes/2+1)
	c.enqueue(message)
	c.enqueue(message)
	select {
	case <-c.closed:
	default:
		t.Fatal("consumer exceeding byte budget was not closed")
	}
	if len(c.send) != 1 || c.queued > maxQueuedBytes {
		t.Fatal("queue exceeded byte budget")
	}
}

func TestCanceledRequestCannotMutate(t *testing.T) {
	bus := memory.New()
	svc, err := files.New(t.TempDir(), bus)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(svc, bus, nil)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = handler.run(ctx, request{ID: 1, Op: "create", Args: json.RawMessage(`{"path":"a.txt"}`)})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("create = %v", err)
	}
	if _, err := svc.Read("a.txt"); !errors.Is(err, files.ErrNotFound) {
		t.Fatalf("canceled request created a file: %v", err)
	}
}
