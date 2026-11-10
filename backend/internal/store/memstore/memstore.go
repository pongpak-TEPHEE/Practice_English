// Package memstore is an in-memory Store for local development and tests.
// Everything is lost when the process exits.
package memstore

import (
	"cmp"
	"context"
	"maps"
	"slices"
	"sync"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

type Store struct {
	mu       sync.Mutex
	words    []vocab.Word
	progress map[int]vocab.Progress
	settings map[string]string
	log      []vocab.LogEntry
	grammar  grammar.Tables
	reading  reading.Tables
	mocks    []reading.MockResult
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

// SetGrammar stores grammar lessons in their sheet form.
func (s *Store) SetGrammar(t grammar.Tables) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.grammar = maps.Clone(t)
}

func (s *Store) LoadGrammar(context.Context) (grammar.Tables, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return maps.Clone(s.grammar), nil
}

// SetReading stores reading sets in their sheet form.
func (s *Store) SetReading(t reading.Tables) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reading = maps.Clone(t)
}

func (s *Store) LoadReading(context.Context) (reading.Tables, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return maps.Clone(s.reading), nil
}

func (s *Store) LoadMockResults(context.Context) ([]reading.MockResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.mocks), nil
}

func (s *Store) AppendMockResult(_ context.Context, r reading.MockResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.mocks = append(s.mocks, r)
	return nil
}
