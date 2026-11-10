// Package memstore is an in-memory Store for local development and tests.
// Everything is lost when the process exits.
package memstore

import (
	"cmp"
	"context"
	"maps"
	"slices"
	"sync"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

type Store struct {
	mu       sync.Mutex
	words    []vocab.Word
	progress map[int]vocab.Progress
	settings map[string]string
	log      []vocab.LogEntry
}

func New(words []vocab.Word) *Store {
	return &Store{words: slices.Clone(words), progress: map[int]vocab.Progress{}, settings: map[string]string{}}
}

func (s *Store) LoadWords(context.Context) ([]vocab.Word, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.words), nil
}

func (s *Store) LoadProgress(context.Context) ([]vocab.Progress, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := slices.Collect(maps.Values(s.progress))
	slices.SortFunc(out, func(a, b vocab.Progress) int { return cmp.Compare(a.WordID, b.WordID) })
	return out, nil
}

func (s *Store) SaveProgress(_ context.Context, ps ...vocab.Progress) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range ps {
		s.progress[p.WordID] = p
	}
	return nil
}

func (s *Store) LoadSettings(context.Context) (map[string]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return maps.Clone(s.settings), nil
}

func (s *Store) SaveSettings(_ context.Context, kv map[string]string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings = maps.Clone(kv)
	return nil
}

func (s *Store) LoadLog(context.Context) ([]vocab.LogEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.log), nil
}

func (s *Store) AppendLog(_ context.Context, es ...vocab.LogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.log = append(s.log, es...)
	return nil
}
