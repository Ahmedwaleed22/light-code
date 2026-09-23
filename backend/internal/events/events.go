// Package events defines the pub/sub contract used by services.
package events

import "context"

type Event struct {
	Topic string
	Data  any
}

type Handler func(context.Context, Event) error

type Bus interface {
	Publish(context.Context, Event) error
	Subscribe(topic string, handler Handler) (unsubscribe func())
}
