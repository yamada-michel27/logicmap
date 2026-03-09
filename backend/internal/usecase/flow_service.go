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

type UpdateFlowInput struct {
	Name        *string
	Description *string
	Links       *[]string
	Snapshot    *json.RawMessage
}

func NewFlowService(repo flow.Repository, limit int) *FlowService {
	return &FlowService{repo: repo, limit: limit}
}

func (s *FlowService) Create(
	ctx context.Context,
	userID, name, description string,
	links []string,
	snapshot json.RawMessage,
) (*flow.Flow, error) {
	name = strings.TrimSpace(name)
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
	return s.repo.Create(ctx, userID, name, strings.TrimSpace(description), normalizeLinks(links), snapshot)
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

func (s *FlowService) Update(
	ctx context.Context,
	userID, flowID string,
	input UpdateFlowInput,
) (*flow.Flow, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(flowID) == "" {
		return nil, ErrInvalidInput
	}

	if input.Name == nil && input.Description == nil && input.Links == nil && input.Snapshot == nil {
		return nil, ErrInvalidInput
	}

	current, err := s.repo.GetByID(ctx, userID, flowID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrNotFound
	}

	name := current.Name
	description := current.Description
	links := append([]string(nil), current.Links...)
	snapshot := current.Snapshot

	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, ErrInvalidInput
		}
	}
	if input.Description != nil {
		description = strings.TrimSpace(*input.Description)
	}
	if input.Links != nil {
		links = normalizeLinks(*input.Links)
	}
	if input.Snapshot != nil {
		if len(*input.Snapshot) == 0 {
			return nil, ErrInvalidInput
		}
		snapshot = *input.Snapshot
	}

	return s.repo.UpdateByID(ctx, userID, flowID, name, description, links, snapshot)
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

func normalizeLinks(links []string) []string {
	if len(links) == 0 {
		return []string{}
	}

	normalized := make([]string, 0, len(links))
	for _, link := range links {
		trimmed := strings.TrimSpace(link)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	return normalized
}
