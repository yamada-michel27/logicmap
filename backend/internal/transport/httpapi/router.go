package httpapi

import (
	"net/http"

	"github.com/yamada-michel27/logicmap/backend/internal/usecase"
)

func NewRouter(service *usecase.FlowService, corsOrigins []string) http.Handler {
	mux := http.NewServeMux()
	handler := NewFlowHandler(service)
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/flows", handler.HandleFlows)
	mux.HandleFunc("/flows/", handler.HandleFlowByID)
	return withCORS(corsOrigins, mux)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
