// Package study implements the learning use cases on top of a Store.
// Words, progress and settings are cached in memory: the Sheets API is slow and
// rate limited, and this is a single-user app, so the cache is the source of truth
// while running and every change is written through to the store.
package study

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

var (
	ErrWordNotFound   = errors.New("word not found")
	ErrLessonNotFound = errors.New("lesson not found")
	// ErrLogNotSaved means the answer counted but its history row could not be written.
	ErrLogNotSaved = errors.New("answer saved but history not recorded")
)

type Store interface {
	LoadWords(ctx context.Context) ([]vocab.Word, error)
	LoadProgress(ctx context.Context) ([]vocab.Progress, error)
	// SaveProgress writes each word's row, overwriting an existing one. It must be
	// safe to retry with the same values after a failure.
	SaveProgress(ctx context.Context, ps ...vocab.Progress) error
	LoadSettings(ctx context.Context) (map[string]string, error)
	SaveSettings(ctx context.Context, kv map[string]string) error
	LoadLog(ctx context.Context) ([]vocab.LogEntry, error)
	AppendLog(ctx context.Context, es ...vocab.LogEntry) error
	LoadGrammar(ctx context.Context) (grammar.Tables, error)
}

// WordView is a word together with the learner's progress on it.
type WordView struct {
	vocab.Word
	Status   string          `json:"status"`
	Progress *vocab.Progress `json:"progress,omitempty"`
}

type Service struct {
	store Store
	loc   *time.Location
	now   func() time.Time

	writeMu sync.Mutex // serialises writes so a word is never appended twice

	mu       sync.RWMutex
	words    []vocab.Word
	wordByID map[int]vocab.Word
	progress map[int]vocab.Progress
	settings Settings
	log      []vocab.LogEntry

	lessons         []grammar.Lesson
	grammarProblems []string // rows in the grammar tabs that could not be used
}

func NewService(ctx context.Context, store Store, loc *time.Location) (*Service, error) {
	s := &Service{store: store, loc: loc, now: time.Now}
	if err := s.Reload(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

// Reload re-reads everything from the store, e.g. after editing the sheet by hand.
func (s *Service) Reload(ctx context.Context) error {
	words, err := s.store.LoadWords(ctx)
	if err != nil {
		return fmt.Errorf("load words: %w", err)
	}
	progress, err := s.store.LoadProgress(ctx)
	if err != nil {
		return fmt.Errorf("load progress: %w", err)
	}
	kv, err := s.store.LoadSettings(ctx)
	if err != nil {
		return fmt.Errorf("load settings: %w", err)
	}

	log, err := s.store.LoadLog(ctx)
	if err != nil {
		return fmt.Errorf("load log: %w", err)
	}
	tables, err := s.store.LoadGrammar(ctx)
	if err != nil {
		return fmt.Errorf("load grammar: %w", err)
	}
	lessons, problems := grammar.Assemble(tables)

	byID := make(map[int]vocab.Word, len(words))
	for _, w := range words {
		byID[w.ID] = w
	}
	pm := make(map[int]vocab.Progress, len(progress))
	for _, p := range progress {
		pm[p.WordID] = p
	}

	s.mu.Lock()
	s.words, s.wordByID, s.progress, s.settings, s.log = words, byID, pm, settingsFromMap(kv), log
	s.lessons, s.grammarProblems = lessons, problems
	s.mu.Unlock()
	return nil
}

func (s *Service) today() time.Time {
	y, m, d := s.now().In(s.loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, s.loc)
}

// view must be called with s.mu held.
func (s *Service) view(w vocab.Word) WordView {
	v := WordView{Word: w}
	if p, ok := s.progress[w.ID]; ok {
		v.Progress = &p
	}
	v.Status = vocab.StatusOf(v.Progress, s.settings.Tiers)
	return v
}

// ---- grammar ----

func (s *Service) GrammarLessons() []grammar.Summary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]grammar.Summary, len(s.lessons))
	for i, l := range s.lessons {
		out[i] = l.Summarize()
	}
	return out
}

func (s *Service) GrammarLesson(id string) (grammar.Lesson, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, l := range s.lessons {
		if l.ID == id {
			return l, nil
		}
	}
	return grammar.Lesson{}, ErrLessonNotFound
}

// GrammarProblems lists grammar rows that were left out at the last load.
// It is never nil, so the API always sends a list.
func (s *Service) GrammarProblems() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]string{}, s.grammarProblems...)
}

// ---- settings ----

func (s *Service) Settings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}

func (s *Service) UpdateSettings(ctx context.Context, next Settings) (Settings, error) {
	if err := next.Validate(); err != nil {
		return Settings{}, err
	}
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if err := s.store.SaveSettings(ctx, next.toMap()); err != nil {
		return Settings{}, fmt.Errorf("save settings: %w", err)
	}
	s.mu.Lock()
	s.settings = next
	s.mu.Unlock()
	return next, nil
}

// ---- word lists ----

// Lists the learner can practise from.
const (
	DeckAll       = ""
	DeckLearned   = "learned"   // every word passed at least once (the review list)
	DeckFavorites = "favorites" // starred words
	DeckMissed    = "missed"    // frequently missed words
	DeckToday     = "today"     // words learned today
)

type WordFilter struct {
	Level  string // A1, A2, B1, B2; empty = all
	Status string // new, learning, familiar, known, mastered; empty = all
	Deck   string // one of the Deck constants
	Query  string // substring match on the English word or Thai meaning
}

func (s *Service) Words(f WordFilter) ([]WordView, error) {
	switch f.Deck {
	case DeckAll, DeckLearned, DeckFavorites, DeckMissed, DeckToday:
	default:
		return nil, fmt.Errorf("deck must be learned, favorites, missed or today")
	}
	q := strings.ToLower(strings.TrimSpace(f.Query))
	today := vocab.FormatDate(s.today())

	s.mu.RLock()
	defer s.mu.RUnlock()
	out := []WordView{}
	for _, w := range s.words {
		if f.Level != "" && !strings.EqualFold(w.Level, f.Level) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(w.Word), q) && !strings.Contains(w.MeaningTH, q) {
			continue
		}
		v := s.view(w)
		if f.Status != "" && v.Status != f.Status {
			continue
		}
		if !inDeck(v.Progress, f.Deck, today) {
			continue
		}
		out = append(out, v)
	}
	if f.Deck != DeckAll {
		// Closest to forgetting first: earliest due date, then weakest.
		slices.SortStableFunc(out, func(a, b WordView) int {
			return cmp.Or(
				cmp.Compare(dueOf(a.Progress), dueOf(b.Progress)),
				cmp.Compare(passDaysOf(a.Progress), passDaysOf(b.Progress)),
			)
		})
	}
	return out, nil
}

func inDeck(p *vocab.Progress, deck, today string) bool {
	switch deck {
	case DeckLearned:
		return p.Learned()
	case DeckFavorites:
		return p != nil && p.Favorite
	case DeckMissed:
		return p != nil && p.Missed
	case DeckToday:
		return p.Learned() && p.LearnedDate == today
	}
	return true
}

func dueOf(p *vocab.Progress) string {
	if p == nil || p.DueDate == "" {
		return "9999-12-31"
	}
	return p.DueDate
}

func passDaysOf(p *vocab.Progress) int {
	if p == nil {
		return 0
	}
	return p.PassDays
}

func (s *Service) Word(id int) (WordView, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w, ok := s.wordByID[id]
	if !ok {
		return WordView{}, ErrWordNotFound
	}
	return s.view(w), nil
}

// ---- today ----

type Today struct {
	Date         string     `json:"date"`
	Level        string     `json:"level"`
	NewGoal      int        `json:"newGoal"`
	LearnedToday int        `json:"learnedToday"`
	RoundsGoal   int        `json:"roundsGoal"`
	RoundsDone   int        `json:"roundsDone"` // full passes through today's words
	DueCount     int        `json:"dueCount"`   // learned words due for review
	NewQueue     []WordView `json:"newQueue"`   // words to learn next, up to the remaining goal
	RoundQueue   []WordView `json:"roundQueue"` // today's words not yet seen in the current round
}

// Today returns the daily goal state. extra adds that many words to the new queue
// beyond today's goal (for "learn more").
func (s *Service) Today(extra int) Today {
	day := vocab.FormatDate(s.today())
	s.mu.RLock()
	defer s.mu.RUnlock()

	t := Today{
		Date: day, Level: s.settings.Level,
		NewGoal: s.settings.NewPerDay, RoundsGoal: s.settings.RoundsPerDay,
		NewQueue: []WordView{}, RoundQueue: []WordView{},
	}
	var todays []vocab.Progress
	var seen, fresh []vocab.Word // seen = answered before but never passed
	for _, w := range s.words {
		p, ok := s.progress[w.ID]
		switch {
		case ok && p.Learned():
			if p.LearnedDate == day {
				todays = append(todays, p)
			}
			if p.DueDate <= day {
				t.DueCount++
			}
		case strings.EqualFold(w.Level, s.settings.Level):
			if ok && p.ReviewCount > 0 {
				seen = append(seen, w)
			} else {
				fresh = append(fresh, w)
			}
		}
	}
	t.LearnedToday = len(todays)

	want := max(0, t.NewGoal-t.LearnedToday) + max(0, extra)
	for _, w := range append(seen, fresh...) {
		if len(t.NewQueue) == want {
			break
		}
		t.NewQueue = append(t.NewQueue, s.view(w))
	}

	if len(todays) > 0 {
		t.RoundsDone = todays[0].RoundsOn(day)
		for _, p := range todays {
			t.RoundsDone = min(t.RoundsDone, p.RoundsOn(day))
		}
		for _, p := range todays {
			if p.RoundsOn(day) == t.RoundsDone {
				t.RoundQueue = append(t.RoundQueue, s.view(s.wordByID[p.WordID]))
			}
		}
	}
	return t
}

// ---- answers ----

// AnswerItem is one pass/fail answer within a practice session.
type AnswerItem struct {
	WordID int          `json:"wordId"`
	Result vocab.Result `json:"result"`
}

// Answer records pass/fail for a word and returns its updated state.
func (s *Service) Answer(ctx context.Context, wordID int, r vocab.Result, mode vocab.Mode) (WordView, error) {
	views, err := s.AnswerBatch(ctx, mode, []AnswerItem{{WordID: wordID, Result: r}})
	if len(views) == 0 {
		return WordView{}, err
	}
	return views[0], err
}

// AnswerBatch applies a whole session's answers in order and saves them together,
// so a session is either counted in full or not at all. It returns each answered
// word once, in first-answered order. Nothing changes if any word is unknown.
func (s *Service) AnswerBatch(ctx context.Context, mode vocab.Mode, items []AnswerItem) ([]WordView, error) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	today := s.today()
	now := s.now().In(s.loc)
	changed := map[int]vocab.Progress{}
	var order []int
	logs := make([]vocab.LogEntry, 0, len(items))

	s.mu.RLock()
	for _, it := range items {
		if _, ok := s.wordByID[it.WordID]; !ok {
			s.mu.RUnlock()
			return nil, fmt.Errorf("%w: id %d", ErrWordNotFound, it.WordID)
		}
		p, seen := changed[it.WordID]
		if !seen {
			if p, seen = s.progress[it.WordID]; !seen {
				p = vocab.NewProgress(it.WordID)
			}
			order = append(order, it.WordID)
		}
		changed[it.WordID] = vocab.Answer(p, it.Result, mode, today)
		logs = append(logs, vocab.LogEntry{
			Date: vocab.FormatDate(now), Time: now.Format("15:04:05"),
			WordID: it.WordID, Mode: mode, Result: it.Result,
		})
	}
	s.mu.RUnlock()

	ps := make([]vocab.Progress, len(order))
	for i, id := range order {
		ps[i] = changed[id]
	}
	// The cache only changes once the store has accepted the progress rows.
	if err := s.store.SaveProgress(ctx, ps...); err != nil {
		return nil, fmt.Errorf("save progress: %w", err)
	}

	s.mu.Lock()
	views := make([]WordView, len(order))
	for i, id := range order {
		s.progress[id] = changed[id]
		views[i] = s.view(s.wordByID[id])
	}
	s.mu.Unlock()

	// Progress is already saved; a lost log row only affects history, so it isn't fatal.
	if err := s.store.AppendLog(ctx, logs...); err != nil {
		return views, fmt.Errorf("%w: %w", ErrLogNotSaved, err)
	}
	s.mu.Lock()
	s.log = append(s.log, logs...)
	s.mu.Unlock()
	return views, nil
}

func (s *Service) SetFavorite(ctx context.Context, wordID int, fav bool) (WordView, error) {
	return s.update(ctx, wordID, func(p vocab.Progress) vocab.Progress {
		p.Favorite = fav
		return p
	})
}

func (s *Service) update(ctx context.Context, wordID int, change func(vocab.Progress) vocab.Progress) (WordView, error) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()

	s.mu.RLock()
	w, ok := s.wordByID[wordID]
	p, exists := s.progress[wordID]
	s.mu.RUnlock()
	if !ok {
		return WordView{}, ErrWordNotFound
	}
	if !exists {
		p = vocab.NewProgress(wordID)
	}

	next := change(p)
	if err := s.store.SaveProgress(ctx, next); err != nil {
		return WordView{}, fmt.Errorf("save progress: %w", err)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.progress[wordID] = next
	return s.view(w), nil
}

// ---- stats ----

type Counts struct {
	Total    int `json:"total"`
	New      int `json:"new"`
	Learning int `json:"learning"`
	Familiar int `json:"familiar"`
	Known    int `json:"known"`
	Mastered int `json:"mastered"`
}

func (c *Counts) add(status string) {
	c.Total++
	switch status {
	case vocab.StatusNew:
		c.New++
	case vocab.StatusLearning:
		c.Learning++
	case vocab.StatusFamiliar:
		c.Familiar++
	case vocab.StatusKnown:
		c.Known++
	case vocab.StatusMastered:
		c.Mastered++
	}
}

type LevelCounts struct {
	Level string `json:"level"`
	Counts
}

type Stats struct {
	Counts
	Favorites     int           `json:"favorites"`
	Missed        int           `json:"missed"`
	DueToday      int           `json:"dueToday"`
	ReviewedToday int           `json:"reviewedToday"`
	ByLevel       []LevelCounts `json:"byLevel"`
}

func (s *Service) Stats() Stats {
	today := vocab.FormatDate(s.today())
	s.mu.RLock()
	defer s.mu.RUnlock()

	var st Stats
	byLevel := map[string]*LevelCounts{}
	for _, w := range s.words {
		lc, ok := byLevel[w.Level]
		if !ok {
			lc = &LevelCounts{Level: w.Level}
			byLevel[w.Level] = lc
		}
		v := s.view(w)
		st.add(v.Status)
		lc.add(v.Status)
		if p := v.Progress; p != nil {
			if p.Favorite {
				st.Favorites++
			}
			if p.Missed {
				st.Missed++
			}
			if p.Learned() && p.DueDate <= today {
				st.DueToday++
			}
			if p.LastReviewed == today {
				st.ReviewedToday++
			}
		}
	}
	for _, lc := range byLevel {
		st.ByLevel = append(st.ByLevel, *lc)
	}
	slices.SortFunc(st.ByLevel, func(a, b LevelCounts) int {
		return cmp.Or(cmp.Compare(vocab.LevelRank(a.Level), vocab.LevelRank(b.Level)), cmp.Compare(a.Level, b.Level))
	})
	return st
}
