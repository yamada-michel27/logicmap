package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/yamada-michel27/logicmap/backend/internal/domain/flow"
)

var (
	ErrLimitReached = errors.New("limit reached")
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid input")
)

type FlowService struct {
	repo  flow.Repository
	limit int
}

func NewFlowService(repo flow.Repository, limit int) *FlowService {
	return &FlowService{repo: repo, limit: limit}
}

func (s *FlowService) Create(ctx context.Context, userID, name string, snapshot json.RawMessage) (*flow.Flow, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(name) == "" || len(snapshot) == 0 {
		return nil, ErrInvalidInput
	}
	count, err := s.repo.CountByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= s.limit {
		return nil, ErrLimitReached
	}
	return s.repo.Create(ctx, userID, name, snapshot)
}

func (s *FlowService) List(ctx context.Context, userID, search string) ([]flow.Summary, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrInvalidInput
	}
	return s.repo.ListByUser(ctx, userID, search, s.limit)
}

func (s *FlowService) Get(ctx context.Context, userID, flowID string) (*flow.Flow, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(flowID) == "" {
		return nil, ErrInvalidInput
	}
	item, err := s.repo.GetByID(ctx, userID, flowID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, ErrNotFound
	}
	return item, nil
}

func (s *FlowService) Delete(ctx context.Context, userID, flowID string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(flowID) == "" {
		return ErrInvalidInput
	}
	deleted, err := s.repo.DeleteByID(ctx, userID, flowID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}
