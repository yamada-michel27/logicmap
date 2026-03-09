package flow

import (
	"encoding/json"
	"time"
)

type Flow struct {
	ID          string
	UserID      string
	Name        string
	Description string
	Links       []string
	Snapshot    json.RawMessage
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Summary struct {
	ID          string
	Name        string
	Description string
	Links       []string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
