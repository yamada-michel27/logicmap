package flow

import (
	"context"
	"encoding/json"
)

type Repository interface {
	CountByUser(ctx context.Context, userID string) (int, error)
	Create(ctx context.Context, userID, name string, snapshot json.RawMessage) (*Flow, error)
	ListByUser(ctx context.Context, userID, search string, limit int) ([]Summary, error)
	GetByID(ctx context.Context, userID, flowID string) (*Flow, error)
	DeleteByID(ctx context.Context, userID, flowID string) (bool, error)
}
