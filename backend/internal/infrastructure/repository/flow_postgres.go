package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/yamada-michel27/logicmap/backend/internal/domain/flow"
)

type FlowPostgresRepository struct {
	db *sql.DB
}

func NewFlowPostgresRepository(db *sql.DB) *FlowPostgresRepository {
	return &FlowPostgresRepository{db: db}
}

func (r *FlowPostgresRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	var count int
	if err := r.db.QueryRowContext(ctx, `SELECT count(*) FROM flows WHERE user_id = $1`, userID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *FlowPostgresRepository) Create(
	ctx context.Context,
	userID, name string,
	snapshot json.RawMessage,
) (*flow.Flow, error) {
	row := r.db.QueryRowContext(
		ctx,
		`INSERT INTO flows (user_id, name, snapshot)
		 VALUES ($1, $2, $3)
		 RETURNING id, created_at, updated_at`,
		userID,
		name,
		snapshot,
	)
	var result flow.Flow
	result.UserID = userID
	result.Name = name
	result.Snapshot = snapshot
	if err := row.Scan(&result.ID, &result.CreatedAt, &result.UpdatedAt); err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *FlowPostgresRepository) ListByUser(
	ctx context.Context,
	userID, search string,
	limit int,
) ([]flow.Summary, error) {
	query := `SELECT id, name, created_at, updated_at
		FROM flows
		WHERE user_id = $1
		AND ($2 = '' OR name ILIKE '%' || $2 || '%')
		ORDER BY created_at DESC
		LIMIT $3`
	rows, err := r.db.QueryContext(ctx, query, userID, search, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []flow.Summary{}
	for rows.Next() {
		var item flow.Summary
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *FlowPostgresRepository) GetByID(
	ctx context.Context,
	userID, flowID string,
) (*flow.Flow, error) {
	row := r.db.QueryRowContext(
		ctx,
		`SELECT id, user_id, name, snapshot, created_at, updated_at
		 FROM flows
		 WHERE id = $1 AND user_id = $2`,
		flowID,
		userID,
	)
	var item flow.Flow
	var snapshot []byte
	if err := row.Scan(&item.ID, &item.UserID, &item.Name, &snapshot, &item.CreatedAt, &item.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	item.Snapshot = json.RawMessage(snapshot)
	return &item, nil
}

func (r *FlowPostgresRepository) UpdateByID(
	ctx context.Context,
	userID, flowID string,
	snapshot json.RawMessage,
) (*flow.Flow, error) {
	row := r.db.QueryRowContext(
		ctx,
		`UPDATE flows
		 SET snapshot = $3, updated_at = CURRENT_TIMESTAMP
		 WHERE id = $1 AND user_id = $2
		 RETURNING id, user_id, name, created_at, updated_at`,
		flowID,
		userID,
		snapshot,
	)
	var item flow.Flow
	err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.Name,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	item.Snapshot = snapshot
	return &item, nil
}

func (r *FlowPostgresRepository) DeleteByID(
	ctx context.Context,
	userID, flowID string,
) (bool, error) {
	result, err := r.db.ExecContext(
		ctx,
		`DELETE FROM flows WHERE id = $1 AND user_id = $2`,
		flowID,
		userID,
	)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return affected > 0, nil
}
