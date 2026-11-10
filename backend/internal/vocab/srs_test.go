package vocab

import (
	"strings"
	"testing"
	"time"
)

var day0 = time.Date(2026, 11, 9, 0, 0, 0, 0, time.UTC)

func TestPassOnDifferentDaysBuildsMastery(t *testing.T) {
	p := NewProgress(1)
	if StatusOf(&p, DefaultTiers) != StatusNew {
		t.Fatal("unreviewed word should be new")
	}
	// Ten passes on the same day count as one pass day.
	for range 10 {
		p = Answer(p, Pass, ModeReview, day0)
	}
	if p.PassDays != 1 || p.PassCount != 10 || p.LearnedDate != "2026-11-09" {
		t.Fatalf("same-day passes: %+v", p)
	}
	if got := StatusOf(&p, DefaultTiers); got != StatusLearning {
		t.Errorf("status after 1 pass day = %s, want learning", got)
	}

	want := map[int]string{2: StatusFamiliar, 5: StatusKnown, 10: StatusMastered}
	for d := 2; d <= 10; d++ {
		p = Answer(p, Pass, ModeReview, day0.AddDate(0, 0, d-1))
		if s, ok := want[d]; ok && StatusOf(&p, DefaultTiers) != s {
			t.Errorf("after %d pass days: status %s, want %s", d, StatusOf(&p, DefaultTiers), s)
		}
	}
}

func TestFailDoesNotLearn(t *testing.T) {
	p := Answer(NewProgress(1), Fail, ModeLearn, day0)
	if p.Learned() || p.FailCount != 1 || p.Recent != "F" {
		t.Fatalf("after fail: %+v", p)
	}
	if p.RoundsToday != 0 {
		t.Error("learn mode must not count review rounds")
	}
}

func TestMissedListEntryAndExit(t *testing.T) {
	p := NewProgress(1)
	for _, r := range []Result{Pass, Fail, Pass, Fail} {
		p = Answer(p, r, ModeReview, day0)
	}
	if p.Missed {
		t.Fatal("should need at least 5 answers before joining")
	}
	p = Answer(p, Fail, ModeReview, day0) // PFPFF: 3 fails in last 5
	if !p.Missed {
		t.Fatalf("should join after 3 of 5 fails: %+v", p)
	}
	p = Answer(p, Pass, ModeReview, day0)
	p = Answer(p, Pass, ModeReview, day0)
	if !p.Missed {
		t.Fatal("two passes are not enough to leave")
	}
	p = Answer(p, Pass, ModeReview, day0)
	if p.Missed || p.Recent != "FFPPP" {
		t.Fatalf("should leave after 3 passes in a row: %+v", p)
	}
}

func TestRoundsResetDaily(t *testing.T) {
	p := Answer(NewProgress(1), Pass, ModeLearn, day0)
	p = Answer(p, Pass, ModeReview, day0)
	p = Answer(p, Fail, ModeReview, day0)
	if p.RoundsOn("2026-11-09") != 2 {
		t.Fatalf("rounds today = %d, want 2", p.RoundsOn("2026-11-09"))
	}
	p = Answer(p, Pass, ModeReview, day0.AddDate(0, 0, 1))
	if p.RoundsOn("2026-11-10") != 1 || p.RoundsOn("2026-11-09") != 0 {
		t.Fatalf("rounds should reset on a new day: %+v", p)
	}
}

func TestScheduleOrdersForgetting(t *testing.T) {
	p := NewProgress(1)
	for _, want := range []int{1, 6, 15} {
		p = Answer(p, Pass, ModeReview, day0)
		if p.Interval != want {
			t.Fatalf("interval = %d, want %d", p.Interval, want)
		}
	}
	p = Answer(p, Fail, ModeReview, day0)
	if p.Interval != 1 || p.DueDate != "2026-11-10" {
		t.Fatalf("fail should bring the word back tomorrow: %+v", p)
	}
}

func TestParse(t *testing.T) {
	if r, err := ParseResult(" Pass "); err != nil || r != Pass {
		t.Errorf("ParseResult = %v, %v", r, err)
	}
	if _, err := ParseResult("good"); err == nil {
		t.Error("expected error")
	}
	if m, err := ParseMode(""); err != nil || m != ModeReview {
		t.Errorf("ParseMode(\"\") = %v, %v", m, err)
	}
}

func TestReadCSV(t *testing.T) {
	in := "\uFEFFWord,POS,Level,meaning_th,audio_us\nability,noun,a2,ความสามารถ,https://x/a.mp3\n,,,\nable,adjective,A2,\n"
	words, err := ReadCSV(strings.NewReader(in))
	if err != nil {
		t.Fatal(err)
	}
	if len(words) != 2 {
		t.Fatalf("got %d words, want 2", len(words))
	}
	if words[0].ID != 1 || words[0].Level != "A2" || words[0].AudioUS != "https://x/a.mp3" {
		t.Errorf("first word = %+v", words[0])
	}
	if words[1].ID != 3 {
		t.Errorf("second word id = %d, want 3 (position in file)", words[1].ID)
	}
	if _, err := ReadCSV(strings.NewReader("id,word\n1,a\n1,b\n")); err == nil {
		t.Error("expected duplicate id error")
	}
}
