package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/yamada-michel27/logicmap/backend/internal/config"
	"github.com/yamada-michel27/logicmap/backend/internal/infrastructure/db"
	"github.com/yamada-michel27/logicmap/backend/internal/infrastructure/repository"
	"github.com/yamada-michel27/logicmap/backend/internal/transport/httpapi"
	"github.com/yamada-michel27/logicmap/backend/internal/usecase"
)

func main() {
	cfg := config.Load()

	// Healthcheck mode: allows container healthcheck without extra tools
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		if err := runHealthCheck(cfg.Port); err != nil {
			log.Printf("healthcheck failed: %v", err)
			os.Exit(1)
		}
		return
	}

	if cfg.DBHost == "" || cfg.DBName == "" || cfg.DBUser == "" || cfg.DBPassword == "" {
		log.Fatal("database configuration is missing")
	}

	dbConn, err := db.Open(db.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		Name:     cfg.DBName,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		SSLMode:  cfg.DBSSLMode,
	})
	if err != nil {
		log.Fatalf("db open failed: %v", err)
	}
	defer dbConn.Close()

	if err := dbConn.Ping(); err != nil {
		log.Fatalf("db ping failed: %v", err)
	}

	migrateCtx, cancel := contextWithTimeout(10 * time.Second)
	if err := db.Migrate(migrateCtx, dbConn); err != nil {
		cancel()
		log.Fatalf("db migrate failed: %v", err)
	}
	cancel()

	flowRepo := repository.NewFlowPostgresRepository(dbConn)
	flowService := usecase.NewFlowService(flowRepo, 30)
	router := httpapi.NewRouter(flowService, cfg.CORSAllowOrigins)

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("Server starting on port %s...", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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

func contextWithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}
