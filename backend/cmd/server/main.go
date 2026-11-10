// Command server runs the TOEIC vocabulary API.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/config"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/httpapi"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/memstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/sheetstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/study"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/video"
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
	for _, p := range svc.GrammarProblems() {
		log.Warn("grammar row skipped", "problem", p)
	}
	for _, p := range svc.ReadingProblems() {
		log.Warn("reading row skipped", "problem", p)
	}
	for _, p := range svc.VideoProblems() {
		log.Warn("video row skipped", "problem", p)
	}
	log.Info("listening", "addr", srv.Addr, "store", cfg.Store, "words", st.Total, "dueToday", st.DueToday,
		"grammarLessons", len(svc.GrammarLessons()), "readingSets", len(svc.Reading().Sets), "videos", len(svc.Videos()))

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
		st, err := sheetstore.New(ctx, cfg.Credentials, cfg.SheetID)
		if err != nil {
			return nil, err
		}
		// Creates any missing tab (e.g. "log" on sheets made before it existed).
		if err := st.Setup(ctx); err != nil {
			return nil, err
		}
		return st, nil
	}
	words := vocab.SampleWords()
	if cfg.WordsCSV != "" {
		var err error
		if words, err = vocab.ReadCSVFiles(vocab.SplitPaths(cfg.WordsCSV)...); err != nil {
			return nil, fmt.Errorf("WORDS_CSV: %w", err)
		}
	}
	mem := memstore.New(words)
	if cfg.GrammarDir != "" {
		lessons, err := grammar.ReadDir(cfg.GrammarDir)
		if err != nil {
			return nil, fmt.Errorf("GRAMMAR_DIR: %w", err)
		}
		mem.SetGrammar(grammar.Flatten(lessons))
	}
	if cfg.ReadingDir != "" {
		content, err := reading.ReadDir(cfg.ReadingDir)
		if err != nil {
			return nil, fmt.Errorf("READING_DIR: %w", err)
		}
		mem.SetReading(reading.Flatten(content))
	}
	if cfg.VideosFile != "" {
		data, err := os.ReadFile(cfg.VideosFile)
		if err != nil {
			return nil, fmt.Errorf("VIDEOS_FILE: %w", err)
		}
		var videos []video.Video
		if err := json.Unmarshal(data, &videos); err != nil {
			return nil, fmt.Errorf("VIDEOS_FILE: %w", err)
		}
		mem.SetVideos(video.Flatten(videos))
	}
	return mem, nil
}
