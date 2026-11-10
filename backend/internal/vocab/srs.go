package vocab

import (
	"fmt"
	"math"
	"strings"
	"time"
)

// Grade is how well the learner recalled a word, on the SM-2 0–5 scale.
type Grade int

const (
	GradeAgain Grade = 1
	GradeGood  Grade = 4
)

// Result is the learner's answer on a card.
type Result string

const (
	Pass Result = "pass"
	Fail Result = "fail"
)

func ParseResult(s string) (Result, error) {
	switch r := Result(strings.ToLower(strings.TrimSpace(s))); r {
	case Pass, Fail:
		return r, nil
	}
	return "", fmt.Errorf("result must be pass or fail (got %q)", s)
}

// Mode says where the answer came from: learning a new word, or reviewing a learned one.
type Mode string

const (
	ModeLearn  Mode = "learn"
	ModeReview Mode = "review"
)

func ParseMode(s string) (Mode, error) {
	switch m := Mode(strings.ToLower(strings.TrimSpace(s))); m {
	case "":
		return ModeReview, nil
	case ModeLearn, ModeReview:
		return m, nil
	}
	return "", fmt.Errorf("mode must be learn or review (got %q)", s)
}

const (
	DefaultEase = 2.5
	MinEase     = 1.3

	recentSize = 5
	// A word joins the frequently-missed list after at least missedMinSeen answers
	// with missedFails or more fails among the last recentSize, and leaves it after
	// missedExitPasses passes in a row.
	missedMinSeen    = 5
	missedFails      = 3
	missedExitPasses = 3
)

// Status values. new = never passed; the rest are mastery tiers.
const (
	StatusNew      = "new"
	StatusLearning = "learning" // พอจำได้ not reached yet
	StatusFamiliar = "familiar" // พอจำได้
	StatusKnown    = "known"    // รู้คำ
	StatusMastered = "mastered" // เชี่ยวชาญ
)

// Tiers are the pass-day thresholds for each mastery tier.
type Tiers struct {
	Familiar int `json:"familiar"`
	Known    int `json:"known"`
	Mastered int `json:"mastered"`
}

var DefaultTiers = Tiers{Familiar: 2, Known: 5, Mastered: 10}

// StatusOf reports a word's status; nil progress means never seen.
func StatusOf(p *Progress, t Tiers) string {
	switch {
	case !p.Learned():
		return StatusNew
	case p.PassDays >= t.Mastered:
		return StatusMastered
	case p.PassDays >= t.Known:
		return StatusKnown
	case p.PassDays >= t.Familiar:
		return StatusFamiliar
	default:
		return StatusLearning
	}
}

func NewProgress(wordID int) Progress {
	return Progress{WordID: wordID, Ease: DefaultEase}
}

// Answer applies one pass/fail answer to p and returns the new state.
// today must already be truncated to the learner's local date.
func Answer(p Progress, r Result, mode Mode, today time.Time) Progress {
	day := FormatDate(today)
	if r == Pass {
		p = schedule(p, GradeGood, today)
		p.PassCount++
		if p.LastPassDate != day {
			p.PassDays++
			p.LastPassDate = day
		}
		if p.LearnedDate == "" {
			p.LearnedDate = day
		}
		p.Recent += "P"
	} else {
		p = schedule(p, GradeAgain, today)
		p.FailCount++
		p.Recent += "F"
	}
	if len(p.Recent) > recentSize {
		p.Recent = p.Recent[len(p.Recent)-recentSize:]
	}

	switch {
	case p.Missed && strings.HasSuffix(p.Recent, strings.Repeat("P", missedExitPasses)):
		p.Missed = false
	case !p.Missed && p.ReviewCount >= missedMinSeen && strings.Count(p.Recent, "F") >= missedFails:
		p.Missed = true
	}

	if mode == ModeReview {
		if p.RoundDate != day {
			p.RoundDate, p.RoundsToday = day, 0
		}
		p.RoundsToday++
	}
	return p
}

// RoundsOn returns how many review rounds the word has had on the given day.
func (p *Progress) RoundsOn(day string) int {
	if p == nil || p.RoundDate != day {
		return 0
	}
	return p.RoundsToday
}

// schedule applies one review using SM-2. Its due date orders the review list.
func schedule(p Progress, g Grade, today time.Time) Progress {
	if p.Ease == 0 {
		p.Ease = DefaultEase
	}
	if g < GradeGood {
		p.Repetitions = 0
		p.Interval = 1
		p.Lapses++
	} else {
		switch p.Repetitions {
		case 0:
			p.Interval = 1
		case 1:
			p.Interval = 6
		default:
			p.Interval = int(math.Round(float64(p.Interval) * p.Ease))
		}
		p.Repetitions++
		q := float64(g)
		p.Ease = math.Max(MinEase, p.Ease+0.1-(5-q)*(0.08+(5-q)*0.02))
		p.Ease = math.Round(p.Ease*100) / 100
	}
	p.ReviewCount++
	p.LastReviewed = FormatDate(today)
	p.DueDate = FormatDate(today.AddDate(0, 0, p.Interval))
	return p
}
