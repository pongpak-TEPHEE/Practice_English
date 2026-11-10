package video

import (
	"fmt"
	"strconv"
	"strings"
)

// TabResults is written by the app, one row per finished practice.
const TabResults = "video_results"

// Modes of practice: type along with the subtitle shown, or type what you hear with it hidden.
const (
	ModeType      = "type"
	ModeDictation = "dictation"
)

type Result struct {
	Date         string   `json:"date"` // set by the server, in the learner's time zone
	Time         string   `json:"time"`
	VideoID      string   `json:"videoId"`
	Mode         string   `json:"mode"`
	LinesDone    int      `json:"linesDone"`
	LinesTotal   int      `json:"linesTotal"`
	WordsCorrect int      `json:"wordsCorrect"` // right the first time, without a hint
	WordsTotal   int      `json:"wordsTotal"`   // words in the lines done
	Replays      int      `json:"replays"`
	Seconds      int      `json:"seconds"`
	Missed       []string `json:"missed"` // words not right the first time, as typed in the subtitle
}

// Validate rejects results that can't be right, so a bad request never reaches the sheet.
func (r Result) Validate() error {
	switch {
	case !idPattern.MatchString(r.VideoID):
		return fmt.Errorf("videoId must be a YouTube video id")
	case r.Mode != ModeType && r.Mode != ModeDictation:
		return fmt.Errorf("mode must be %q or %q", ModeType, ModeDictation)
	case r.LinesTotal < 1 || r.LinesTotal > 2000:
		return fmt.Errorf("linesTotal must be 1 to 2000")
	case r.LinesDone < 1 || r.LinesDone > r.LinesTotal:
		return fmt.Errorf("linesDone must be 1 to linesTotal")
	case r.WordsTotal < 1 || r.WordsTotal > 50000:
		return fmt.Errorf("wordsTotal must be 1 to 50000")
	case r.WordsCorrect < 0 || r.WordsCorrect > r.WordsTotal:
		return fmt.Errorf("wordsCorrect must be 0 to wordsTotal")
	case r.Replays < 0 || r.Replays > 100000:
		return fmt.Errorf("replays must not be negative")
	case r.Seconds < 1 || r.Seconds > 6*60*60:
		return fmt.Errorf("seconds must be 1 second to 6 hours")
	case len(r.Missed) > r.WordsTotal-r.WordsCorrect:
		return fmt.Errorf("missed lists more words than were missed")
	}
	for _, w := range r.Missed {
		if w == "" || len(w) > 60 || strings.ContainsAny(w, "\n,") {
			return fmt.Errorf("missed words must be single words")
		}
	}
	return nil
}

var ResultHeader = []string{"date", "time", "video_id", "mode", "lines_done", "lines_total",
	"words_correct", "words_total", "replays", "seconds", "missed"}

func ResultRow(r Result) []any {
	return []any{r.Date, r.Time, r.VideoID, r.Mode, r.LinesDone, r.LinesTotal,
		r.WordsCorrect, r.WordsTotal, r.Replays, r.Seconds, strings.Join(r.Missed, ", ")}
}

// ParseResultRow reads a row written by ResultRow.
func ParseResultRow(row []string) (Result, error) {
	get := func(i int) string {
		if i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	r := Result{Date: get(0), Time: get(1), VideoID: get(2), Mode: get(3), Missed: []string{}}
	for i, dst := range []*int{&r.LinesDone, &r.LinesTotal, &r.WordsCorrect, &r.WordsTotal, &r.Replays, &r.Seconds} {
		n, err := strconv.Atoi(get(4 + i))
		if err != nil {
			return r, fmt.Errorf("column %s: %q is not a number", ResultHeader[4+i], get(4+i))
		}
		*dst = n
	}
	for _, w := range strings.Split(get(10), ",") {
		if w = strings.TrimSpace(w); w != "" {
			r.Missed = append(r.Missed, w)
		}
	}
	return r, nil
}
