package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/yamada-michel27/logicmap/backend/internal/usecase"
)

type FlowHandler struct {
	service *usecase.FlowService
}

func NewFlowHandler(service *usecase.FlowService) *FlowHandler {
	return &FlowHandler{service: service}
}

func (h *FlowHandler) HandleFlows(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listFlows(w, r)
	case http.MethodPost:
		h.createFlow(w, r)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *FlowHandler) HandleFlowByID(w http.ResponseWriter, r *http.Request) {
	flowID := strings.TrimPrefix(r.URL.Path, "/flows/")
	if flowID == "" || flowID == r.URL.Path {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		h.getFlow(w, r, flowID)
	case http.MethodPut:
		h.updateFlow(w, r, flowID)
	case http.MethodDelete:
		h.deleteFlow(w, r, flowID)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

type createFlowRequest struct {
	Name     string          `json:"name"`
	Snapshot json.RawMessage `json:"snapshot"`
}

type flowSummaryResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type flowDetailResponse struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Snapshot  json.RawMessage `json:"snapshot"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

func (h *FlowHandler) listFlows(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id")
		return
	}
	search := strings.TrimSpace(r.URL.Query().Get("q"))
	ctx, cancel := contextWithTimeout(r, 5*time.Second)
	defer cancel()
	items, err := h.service.List(ctx, userID, search)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list_failed")
		return
	}
	response := make([]flowSummaryResponse, 0, len(items))
	for _, item := range items {
		response = append(response, flowSummaryResponse{
			ID:        item.ID,
			Name:      item.Name,
			CreatedAt: item.CreatedAt.Format(time.RFC3339),
			UpdatedAt: item.UpdatedAt.Format(time.RFC3339),
		})
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *FlowHandler) createFlow(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id")
		return
	}
	var req createFlowRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20))
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body")
		return
	}
	ctx, cancel := contextWithTimeout(r, 5*time.Second)
	defer cancel()
	result, err := h.service.Create(ctx, userID, strings.TrimSpace(req.Name), req.Snapshot)
	if err != nil {
		switch err {
		case usecase.ErrLimitReached:
			writeError(w, http.StatusConflict, "limit_reached")
		case usecase.ErrInvalidInput:
			writeError(w, http.StatusBadRequest, "invalid_input")
		default:
			writeError(w, http.StatusInternalServerError, "create_failed")
		}
		return
	}
	writeJSON(w, http.StatusCreated, flowSummaryResponse{
		ID:        result.ID,
		Name:      result.Name,
		CreatedAt: result.CreatedAt.Format(time.RFC3339),
		UpdatedAt: result.UpdatedAt.Format(time.RFC3339),
	})
}

type updateFlowRequest struct {
	Snapshot json.RawMessage `json:"snapshot"`
}

func (h *FlowHandler) updateFlow(w http.ResponseWriter, r *http.Request, flowID string) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id")
		return
	}
	var req updateFlowRequest
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 10<<20))
	if err := decoder.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_body")
		return
	}
	ctx, cancel := contextWithTimeout(r, 5*time.Second)
	defer cancel()
	result, err := h.service.Update(ctx, userID, flowID, req.Snapshot)
	if err != nil {
		switch err {
		case usecase.ErrNotFound:
			writeError(w, http.StatusNotFound, "not_found")
		case usecase.ErrInvalidInput:
			writeError(w, http.StatusBadRequest, "invalid_input")
		default:
			writeError(w, http.StatusInternalServerError, "update_failed")
		}
		return
	}
	writeJSON(w, http.StatusOK, flowSummaryResponse{
		ID:        result.ID,
		Name:      result.Name,
		CreatedAt: result.CreatedAt.Format(time.RFC3339),
		UpdatedAt: result.UpdatedAt.Format(time.RFC3339),
	})
}

func (h *FlowHandler) getFlow(w http.ResponseWriter, r *http.Request, flowID string) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id")
		return
	}
	ctx, cancel := contextWithTimeout(r, 5*time.Second)
	defer cancel()
	item, err := h.service.Get(ctx, userID, flowID)
	if err != nil {
		if err == usecase.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found")
			return
		}
		if err == usecase.ErrInvalidInput {
			writeError(w, http.StatusBadRequest, "invalid_input")
			return
		}
		writeError(w, http.StatusInternalServerError, "get_failed")
		return
	}
	writeJSON(w, http.StatusOK, flowDetailResponse{
		ID:        item.ID,
		Name:      item.Name,
		Snapshot:  item.Snapshot,
		CreatedAt: item.CreatedAt.Format(time.RFC3339),
		UpdatedAt: item.UpdatedAt.Format(time.RFC3339),
	})
}

func (h *FlowHandler) deleteFlow(w http.ResponseWriter, r *http.Request, flowID string) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "missing_user_id")
		return
	}
	ctx, cancel := contextWithTimeout(r, 5*time.Second)
	defer cancel()
	if err := h.service.Delete(ctx, userID, flowID); err != nil {
		if err == usecase.ErrNotFound {
			writeError(w, http.StatusNotFound, "not_found")
			return
		}
		if err == usecase.ErrInvalidInput {
			writeError(w, http.StatusBadRequest, "invalid_input")
			return
		}
		writeError(w, http.StatusInternalServerError, "delete_failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
