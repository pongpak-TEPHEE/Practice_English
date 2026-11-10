// Command server runs the TOEIC vocabulary API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/config"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/httpapi"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/memstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/sheetstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/study"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := buildStore(ctx, cfg)
	if err != nil {
		return err
	}
	svc, err := study.NewService(ctx, store, cfg.Location)
	if err != nil {
		return err
	}
	if cfg.APIToken == "" {
		log.Warn("API_TOKEN is not set: the API is open to anyone")
	}

	srv := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewHandler(svc, httpapi.Options{
			APIToken:       cfg.APIToken,
			AllowedOrigins: cfg.AllowedOrigins,
			Logger:         log,
		}),
		ReadHeaderTimeout: 10 * time.Second,
	}
	st := svc.Stats()
	log.Info("listening", "addr", srv.Addr, "store", cfg.Store, "words", st.Total, "dueToday", st.DueToday)

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func buildStore(ctx context.Context, cfg config.Config) (study.Store, error) {
	if cfg.Store == "sheets" {
		return sheetstore.New(ctx, cfg.Credentials, cfg.SheetID)
	}
	words := vocab.SampleWords()
	if cfg.WordsCSV != "" {
		f, err := os.Open(cfg.WordsCSV)
		if err != nil {
			return nil, fmt.Errorf("WORDS_CSV: %w", err)
		}
		defer f.Close()
		if words, err = vocab.ReadCSV(f); err != nil {
			return nil, fmt.Errorf("WORDS_CSV: %w", err)
		}
	}
	return memstore.New(words), nil
}
