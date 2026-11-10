package sheetstore

import (
	"fmt"
	"strings"
	"testing"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

func TestProgressRoundTrip(t *testing.T) {
	want := vocab.Progress{WordID: 42, Ease: 2.36, Interval: 6, Repetitions: 2,
		DueDate: "2026-11-15", LastReviewed: "2026-11-09", ReviewCount: 3, Lapses: 1,
		Favorite: true, PassCount: 2, FailCount: 1, PassDays: 2, LastPassDate: "2026-11-09",
		Recent: "PFP", Missed: false, LearnedDate: "2026-11-08", RoundDate: "2026-11-09", RoundsToday: 2}

	// The Sheets API returns formatted values as strings, booleans as TRUE/FALSE.
	row := []any{}
	for _, v := range progressRow(want) {
		row = append(row, strings.ToUpper(fmt.Sprint(v)))
	}
	row[13] = want.Recent
	got, err := parseProgress(row)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Errorf("got  %+v\nwant %+v", got, want)
	}
	if len(progressRow(want)) != len(progressHeader) {
		t.Error("progress row and header lengths differ")
	}
}

func TestParseProgressShortRow(t *testing.T) {
	// Rows written before the extra columns existed must still load.
	p, err := parseProgress([]any{"7", "2.5", "1", "1", "2026-11-10", "2026-11-09", "1", "0"})
	if err != nil || p.WordID != 7 || p.Favorite || p.LearnedDate != "" {
		t.Errorf("got %+v, %v", p, err)
	}
	if _, err := parseProgress([]any{"7", "x"}); err == nil {
		t.Error("expected error for non-numeric ease")
	}
}

func TestFirstRow(t *testing.T) {
	for in, want := range map[string]int{"progress!A5:R5": 5, "'progress'!A123:R123": 123} {
		got, err := firstRow(in)
		if err != nil || got != want {
			t.Errorf("firstRow(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
}
