// Package events defines the pub/sub contract used by services.
package events

import "context"

type Event struct {
	Topic string
	Data  any
	// Origin identifies the connection that caused the event, so transports can skip echoing it back.
	Origin string
}

type Handler func(context.Context, Event) error

type Bus interface {
	Publish(context.Context, Event) error
	Subscribe(topic string, handler Handler) (unsubscribe func())
}

type originKey struct{}

// WithOrigin tags a request context with the connection that issued it.
func WithOrigin(ctx context.Context, origin string) context.Context {
	return context.WithValue(ctx, originKey{}, origin)
}

func OriginFrom(ctx context.Context) string {
	origin, _ := ctx.Value(originKey{}).(string)
	return origin
}
