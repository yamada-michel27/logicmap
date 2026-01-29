package httpapi

import (
	"context"
	"net/http"
	"time"
)

func contextWithTimeout(r *http.Request, timeout time.Duration) (context.Context, context.CancelFunc) {
	if r.Context() == nil {
		return context.WithTimeout(context.Background(), timeout)
	}
	return context.WithTimeout(r.Context(), timeout)
}
