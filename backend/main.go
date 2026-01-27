package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
