package db

import (
	"context"
	"database/sql"
)

func Migrate(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
		`CREATE TABLE IF NOT EXISTS flows (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id text NOT NULL,
			name text NOT NULL,
			snapshot jsonb NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_flows_user_created ON flows (user_id, created_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_flows_user_name ON flows (user_id, name);`,
	}
	for _, stmt := range statements {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}
