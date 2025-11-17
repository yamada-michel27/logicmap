package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type ParseRequest struct {
	Markdown string `json:"markdown"`
}

type Node struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Data     map[string]interface{} `json:"data"`
	Position struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"position"`
}

type Edge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

type ParseResponse struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func parseHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ParseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Mock response with sample nodes and edges
	nodes := []Node{
		{
			ID:   "1",
			Type: "input",
			Data: map[string]interface{}{
				"label": "Start",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 0},
		},
		{
			ID:   "2",
			Type: "default",
			Data: map[string]interface{}{
				"label": "Process: " + req.Markdown[:min(20, len(req.Markdown))] + "...",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 100},
		},
		{
			ID:   "3",
			Type: "default",
			Data: map[string]interface{}{
				"label": "Decision",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 200},
		},
		{
			ID:   "4",
			Type: "output",
			Data: map[string]interface{}{
				"label": "End",
			},
			Position: struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
			}{X: 250, Y: 300},
		},
	}

	edges := []Edge{
		{ID: "e1-2", Source: "1", Target: "2"},
		{ID: "e2-3", Source: "2", Target: "3"},
		{ID: "e3-4", Source: "3", Target: "4", Label: "true"},
	}

	response := ParseResponse{
		Nodes: nodes,
		Edges: edges,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Healthcheck mode: allows container healthcheck without extra tools
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		if err := runHealthCheck(port); err != nil {
			log.Printf("healthcheck failed: %v", err)
			os.Exit(1)
		}
		return
	}

	http.HandleFunc("/parse", parseHandler)
	http.HandleFunc("/health", healthHandler)

	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func runHealthCheck(port string) error {
	target := "http://localhost:" + port + "/health"
	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Get(target)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}

	return nil
}
