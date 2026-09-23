// Package memory provides a synchronous, process-local event bus for development.
package memory

import (
	"context"
	"errors"
	"sync"

	"project/backend/internal/events"
)

type Bus struct {
	mu       sync.RWMutex
	nextID   uint64
	handlers map[string]map[uint64]events.Handler
}

func New() *Bus {
	return &Bus{handlers: make(map[string]map[uint64]events.Handler)}
}

func (b *Bus) Subscribe(topic string, handler events.Handler) func() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.nextID++
	id := b.nextID
	if b.handlers[topic] == nil {
		b.handlers[topic] = make(map[uint64]events.Handler)
	}
	b.handlers[topic][id] = handler

	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		delete(b.handlers[topic], id)
		if len(b.handlers[topic]) == 0 {
			delete(b.handlers, topic)
		}
	}
}

func (b *Bus) Publish(ctx context.Context, event events.Event) error {
	b.mu.RLock()
	handlers := make([]events.Handler, 0, len(b.handlers[event.Topic]))
	for _, handler := range b.handlers[event.Topic] {
		handlers = append(handlers, handler)
	}
	b.mu.RUnlock()

	var errs []error
	for _, handler := range handlers {
		if err := ctx.Err(); err != nil {
			return errors.Join(append(errs, err)...)
		}
		if err := handler(ctx, event); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}
