package config

import (
	"os"
	"strings"
)

type Config struct {
	Port             string
	DBHost           string
	DBPort           string
	DBName           string
	DBUser           string
	DBPassword       string
	DBSSLMode        string
	CORSAllowOrigins []string
}

func Load() Config {
	port := getEnv("PORT", "8080")
	dbHost := getEnv("DB_HOST", "")
	dbPort := getEnv("DB_PORT", "5432")
	dbName := getEnv("DB_NAME", "")
	dbUser := getEnv("DB_USER", "")
	dbPassword := getEnv("DB_PASSWORD", "")
	dbSSLMode := getEnv("DB_SSLMODE", "disable")
	originsRaw := getEnv("CORS_ALLOW_ORIGINS", "*")
	return Config{
		Port:             port,
		DBHost:           dbHost,
		DBPort:           dbPort,
		DBName:           dbName,
		DBUser:           dbUser,
		DBPassword:       dbPassword,
		DBSSLMode:        dbSSLMode,
		CORSAllowOrigins: splitCSV(originsRaw),
	}
}

func splitCSV(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
