package memory

import (
	"context"
	"errors"
	"testing"

	"project/backend/internal/events"
)

func TestPublishAndUnsubscribe(t *testing.T) {
	bus := New()
	calls := 0
	unsubscribe := bus.Subscribe("orders.created", func(_ context.Context, event events.Event) error {
		if event.Data != "order-1" {
			t.Fatalf("unexpected event data: %v", event.Data)
		}
		calls++
		return nil
	})

	if err := bus.Publish(context.Background(), events.Event{Topic: "orders.created", Data: "order-1"}); err != nil {
		t.Fatal(err)
	}
	unsubscribe()
	if err := bus.Publish(context.Background(), events.Event{Topic: "orders.created", Data: "order-1"}); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("handler called %d times, want 1", calls)
	}
}

func TestPublishReturnsHandlerError(t *testing.T) {
	bus := New()
	want := errors.New("delivery failed")
	bus.Subscribe("orders.created", func(context.Context, events.Event) error { return want })
	if err := bus.Publish(context.Background(), events.Event{Topic: "orders.created"}); !errors.Is(err, want) {
		t.Fatalf("Publish error = %v, want %v", err, want)
	}
}
