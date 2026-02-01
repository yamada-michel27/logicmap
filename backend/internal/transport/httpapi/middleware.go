package httpapi

import (
	"log"
	"net/http"
	"strings"
)

func withCORS(origins []string, next http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(origins))
	allowAll := false
	for _, origin := range origins {
		if origin == "*" {
			allowAll = true
		} else if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if allowAll {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" {
			if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-Id")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getUserID(r *http.Request) string {
	rawUserID := r.Header.Get("X-User-Id")
	userID := strings.TrimSpace(rawUserID)
	log.Printf("REQUEST: %s %s - getUserID raw: '%s' (len=%d), trimmed: '%s' (len=%d), isEmpty: %t",
		r.Method, r.URL.Path, rawUserID, len(rawUserID), userID, len(userID), userID == "")
	if userID == "" {
		// デバッグ: すべてのヘッダーを出力
		log.Printf("Missing X-User-Id for %s %s", r.Method, r.URL.Path)
		for name, values := range r.Header {
			for _, value := range values {
				log.Printf("Header: %s = %s", name, value)
			}
		}
	}
	return userID
}
