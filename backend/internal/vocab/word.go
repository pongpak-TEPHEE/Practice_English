// Package vocab holds the core vocabulary types and the learning rules.
package vocab

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

// Word is one entry from the Oxford 3000 list.
type Word struct {
	ID        int    `json:"id"`
	Word      string `json:"word"`
	POS       string `json:"pos"`
	Level     string `json:"level"`
	MeaningTH string `json:"meaningTh"`
	Example   string `json:"example"`
	AudioUK   string `json:"audioUk"`
	AudioUS   string `json:"audioUs"`
}

// Progress is the learner's state for one word.
// Dates are stored as YYYY-MM-DD strings so they read naturally in Google Sheets.
type Progress struct {
	WordID int `json:"wordId"`

	// SM-2 scheduling, used to order the review list (closest to forgetting first).
	Ease         float64 `json:"ease"`
	Interval     int     `json:"interval"`
	Repetitions  int     `json:"repetitions"`
	DueDate      string  `json:"dueDate"`
	LastReviewed string  `json:"lastReviewed"`
	ReviewCount  int     `json:"reviewCount"`
	Lapses       int     `json:"lapses"`

	Favorite     bool   `json:"favorite"`
	PassCount    int    `json:"passCount"`
	FailCount    int    `json:"failCount"`
	PassDays     int    `json:"passDays"` // days with at least one pass; drives mastery
	LastPassDate string `json:"lastPassDate"`
	Recent       string `json:"recent"` // last results, oldest first, e.g. "PFFPF"
	Missed       bool   `json:"missed"` // in the "frequently missed" list
	LearnedDate  string `json:"learnedDate"`
	RoundDate    string `json:"roundDate"`
	RoundsToday  int    `json:"roundsToday"` // review-mode passes through this word on RoundDate
}

// Learned reports whether the word has been passed at least once.
func (p *Progress) Learned() bool { return p != nil && p.LearnedDate != "" }

const DateLayout = "2006-01-02"

func FormatDate(t time.Time) string { return t.Format(DateLayout) }

// Levels are the CEFR levels used by the Oxford 3000, easiest first.
var Levels = []string{"A1", "A2", "B1", "B2"}

// LevelRank orders levels for "learn easier words first"; unknown levels sort last.
func LevelRank(level string) int {
	for i, l := range Levels {
		if strings.EqualFold(l, level) {
			return i
		}
	}
	return len(Levels)
}

// ReadCSV parses a word list. The first row must be a header containing at least
// "word"; optional columns are id, pos, level, meaning_th, example, audio_uk, audio_us.
// Rows without an id get one from their position in the file.
func ReadCSV(r io.Reader) ([]Word, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	cr.TrimLeadingSpace = true
	records, err := cr.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("read csv: %w", err)
	}
	if len(records) == 0 {
		return nil, errors.New("csv is empty")
	}

	col := map[string]int{}
	for i, h := range records[0] {
		col[strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\uFEFF")))] = i
	}
	if _, ok := col["word"]; !ok {
		return nil, errors.New(`csv header must include a "word" column`)
	}
	get := func(rec []string, name string) string {
		i, ok := col[name]
		if !ok || i >= len(rec) {
			return ""
		}
		return strings.TrimSpace(rec[i])
	}

	words := make([]Word, 0, len(records)-1)
	seen := map[int]bool{}
	for n, rec := range records[1:] {
		w := Word{
			Word:      get(rec, "word"),
			POS:       get(rec, "pos"),
			Level:     strings.ToUpper(get(rec, "level")),
			MeaningTH: get(rec, "meaning_th"),
			Example:   get(rec, "example"),
			AudioUK:   get(rec, "audio_uk"),
			AudioUS:   get(rec, "audio_us"),
		}
		if w.Word == "" {
			continue
		}
		w.ID = n + 1
		if s := get(rec, "id"); s != "" {
			id, err := strconv.Atoi(s)
			if err != nil {
				return nil, fmt.Errorf("line %d: invalid id %q", n+2, s)
			}
			w.ID = id
		}
		if seen[w.ID] {
			return nil, fmt.Errorf("line %d: duplicate id %d", n+2, w.ID)
		}
		seen[w.ID] = true
		words = append(words, w)
	}
	return words, nil
}

// SampleWords lets the server run locally before the real list is loaded.
func SampleWords() []Word {
	w := func(id int, word, pos, level, th, ex string) Word {
		return Word{ID: id, Word: word, POS: pos, Level: level, MeaningTH: th, Example: ex}
	}
	return []Word{
		w(1, "accept", "verb", "A2", "ยอมรับ", "We accept payment by credit card."),
		w(2, "account", "noun", "B1", "บัญชี", "Please check your account balance."),
		w(3, "advertise", "verb", "A2", "โฆษณา", "The company advertises its products online."),
		w(4, "agree", "verb", "A1", "เห็นด้วย, ตกลง", "Both sides agreed to the new terms."),
		w(5, "apply", "verb", "A2", "สมัคร, ยื่นคำขอ", "She applied for the manager position."),
		w(6, "arrange", "verb", "A2", "จัดเตรียม, นัดหมาย", "I will arrange a meeting for Monday."),
		w(7, "budget", "noun", "B1", "งบประมาณ", "The project is over budget."),
		w(8, "colleague", "noun", "A2", "เพื่อนร่วมงาน", "My colleague will send you the report."),
		w(9, "deliver", "verb", "A2", "จัดส่ง", "The order will be delivered within three days."),
		w(10, "acquire", "verb", "B2", "ได้มา, เข้าซื้อกิจการ", "The bank plans to acquire a smaller rival."),
	}
}
