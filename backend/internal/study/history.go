package study

import (
	"slices"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

// DayWord is one word studied on a day, with how it went that day.
type DayWord struct {
	WordID int    `json:"wordId"`
	Word   string `json:"word"`
	Level  string `json:"level"`
	Passes int    `json:"passes"`
	Fails  int    `json:"fails"`
}

// Day is what was studied on one date: new words learned and words reviewed.
type Day struct {
	Date     string    `json:"date"`
	Learned  []DayWord `json:"learned"`
	Reviewed []DayWord `json:"reviewed"`
}

// History returns the most recent days that have any answers, newest first.
// level filters to words of that level; empty means all.
func (s *Service) History(days int, level string) []Day {
	s.mu.RLock()
	defer s.mu.RUnlock()

	type key struct {
		date string
		mode vocab.Mode
		id   int
	}
	byKey := map[key]*DayWord{}
	order := map[string][]key{} // keeps first-seen order inside each day
	var dates []string
	for _, e := range s.log {
		w, ok := s.wordByID[e.WordID]
		if !ok || (level != "" && w.Level != level) {
			continue
		}
		mode := e.Mode
		if mode != vocab.ModeLearn {
			mode = vocab.ModeReview
		}
		k := key{e.Date, mode, e.WordID}
		dw, ok := byKey[k]
		if !ok {
			dw = &DayWord{WordID: w.ID, Word: w.Word, Level: w.Level}
			byKey[k] = dw
			if len(order[e.Date]) == 0 {
				dates = append(dates, e.Date)
			}
			order[e.Date] = append(order[e.Date], k)
		}
		if e.Result == vocab.Pass {
			dw.Passes++
		} else {
			dw.Fails++
		}
	}

	slices.Sort(dates)
	slices.Reverse(dates)
	dates = slices.Compact(dates)
	if days > 0 && len(dates) > days {
		dates = dates[:days]
	}
	out := make([]Day, 0, len(dates))
	for _, d := range dates {
		day := Day{Date: d, Learned: []DayWord{}, Reviewed: []DayWord{}}
		for _, k := range order[d] {
			if k.mode == vocab.ModeLearn {
				day.Learned = append(day.Learned, *byKey[k])
			} else {
				day.Reviewed = append(day.Reviewed, *byKey[k])
			}
		}
		out = append(out, day)
	}
	return out
}

// DayGoal is one day's progress against the daily goals.
type DayGoal struct {
	Date     string `json:"date"`
	New      int    `json:"new"`      // words first learned that day
	Reviewed int    `json:"reviewed"` // distinct words reviewed that day
	Met      bool   `json:"met"`
}

type Achievements struct {
	NewGoal      int       `json:"newGoal"`
	ReviewGoal   int       `json:"reviewGoal"`
	Today        DayGoal   `json:"today"`
	Streak       int       `json:"streak"`     // consecutive days meeting both goals, ending today or yesterday
	BestStreak   int       `json:"bestStreak"` // longest run ever
	DaysMet      int       `json:"daysMet"`
	TotalLearned int       `json:"totalLearned"`
	Recent       []DayGoal `json:"recent"` // last 14 days, oldest first
}

const recentDays = 14

func (s *Service) Achievements() Achievements {
	today := s.today()
	s.mu.RLock()
	defer s.mu.RUnlock()

	newBy := map[string]int{}
	for _, p := range s.progress {
		if p.Learned() {
			newBy[p.LearnedDate]++
		}
	}
	seen := map[string]map[int]bool{}
	var first string
	for _, e := range s.log {
		if first == "" || e.Date < first {
			first = e.Date
		}
		if e.Mode == vocab.ModeLearn {
			continue
		}
		if seen[e.Date] == nil {
			seen[e.Date] = map[int]bool{}
		}
		seen[e.Date][e.WordID] = true
	}
	for d := range newBy {
		if first == "" || d < first {
			first = d
		}
	}

	goals := s.settings
	dayGoal := func(t time.Time) DayGoal {
		d := vocab.FormatDate(t)
		g := DayGoal{Date: d, New: newBy[d], Reviewed: len(seen[d])}
		g.Met = g.New >= goals.NewPerDay && g.Reviewed >= goals.ReviewPerDay
		return g
	}

	a := Achievements{NewGoal: goals.NewPerDay, ReviewGoal: goals.ReviewPerDay, Today: dayGoal(today)}
	for _, n := range newBy {
		a.TotalLearned += n
	}
	for i := recentDays - 1; i >= 0; i-- {
		a.Recent = append(a.Recent, dayGoal(today.AddDate(0, 0, -i)))
	}

	if first != "" {
		start, err := time.ParseInLocation(vocab.DateLayout, first, s.loc)
		if err == nil {
			run := 0
			for t := start; !t.After(today); t = t.AddDate(0, 0, 1) {
				if dayGoal(t).Met {
					run++
					a.DaysMet++
					a.BestStreak = max(a.BestStreak, run)
				} else if !t.Equal(today) { // today still in progress doesn't break the streak
					run = 0
				}
			}
			a.Streak = run
		}
	}
	return a
}
