// Package config reads server settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
	_ "time/tzdata" // embed zone data so Asia/Bangkok works on minimal hosts
)

type Config struct {
	Port           string
	Store          string // "memory" or "sheets"
	WordsCSV       string // memory store only: optional comma-separated word list files to load
	GrammarDir     string // memory store only: optional folder of grammar lesson JSON files
	ReadingDir     string // memory store only: optional folder of reading set JSON files
	SheetID        string
	Credentials    []byte
	APIToken       string
	AllowedOrigins []string
	Location       *time.Location
}

func Load() (Config, error) {
	c := Config{
		Port:       env("PORT", "8080"),
		Store:      env("STORE", "memory"),
		WordsCSV:   os.Getenv("WORDS_CSV"),
		GrammarDir: os.Getenv("GRAMMAR_DIR"),
		ReadingDir: os.Getenv("READING_DIR"),
		SheetID:    os.Getenv("GOOGLE_SHEET_ID"),
		APIToken:   os.Getenv("API_TOKEN"),
	}
	for _, o := range strings.Split(env("ALLOWED_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, o)
		}
	}

	loc, err := time.LoadLocation(env("APP_TIMEZONE", "Asia/Bangkok"))
	if err != nil {
		return c, fmt.Errorf("APP_TIMEZONE: %w", err)
	}
	c.Location = loc

	switch c.Store {
	case "memory":
	case "sheets":
		if c.SheetID == "" {
			return c, errors.New("GOOGLE_SHEET_ID is required when STORE=sheets")
		}
		if c.Credentials, err = LoadCredentials(); err != nil {
			return c, err
		}
	default:
		return c, fmt.Errorf("STORE must be memory or sheets, got %q", c.Store)
	}
	return c, nil
}

// LoadCredentials reads the service-account key from GOOGLE_CREDENTIALS_JSON
// (the file's contents) or GOOGLE_CREDENTIALS_FILE (a path to it).
func LoadCredentials() ([]byte, error) {
	if j := os.Getenv("GOOGLE_CREDENTIALS_JSON"); j != "" {
		return []byte(j), nil
	}
	if path := os.Getenv("GOOGLE_CREDENTIALS_FILE"); path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("GOOGLE_CREDENTIALS_FILE: %w", err)
		}
		return b, nil
	}
	return nil, errors.New("set GOOGLE_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_FILE")
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
