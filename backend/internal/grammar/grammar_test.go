package grammar

import (
	"encoding/json"
	"strings"
	"testing"
)

// The shipped lessons must survive the trip into sheet rows and back unchanged,
// with nothing flagged.
func TestShippedLessonsRoundTrip(t *testing.T) {
	lessons, err := ReadDir("../../data/grammar")
	if err != nil {
		t.Fatal(err)
	}
	if len(lessons) == 0 {
		t.Fatal("no lessons in data/grammar")
	}
	got, problems := Assemble(Flatten(lessons))
	for _, p := range problems {
		t.Errorf("problem: %s", p)
	}
	want, _ := json.Marshal(lessons)
	have, _ := json.Marshal(got)
	if string(want) != string(have) {
		t.Errorf("round trip changed the lessons:\nwant %.300s\nhave %.300s", want, have)
	}
	for _, l := range got {
		s := l.Summarize()
		t.Logf("%s: %d sections, %d drills", s.ID, s.Sections, s.Drills)
	}
}

func TestAssembleSkipsBadRows(t *testing.T) {
	tables := Tables{
		TabLessons: {
			{"l1", "บทที่หนึ่ง", "One", "", "", "", "", "a\n\n b ", "", "", "step 1\nstep 2"},
			{"", "", ""}, // blank row: ignored silently
			{"l1", "ซ้ำ"},
		},
		TabSections: {
			{"l1", "s1", "หัวข้อ", "urgent", "intro", ""},
			{"nope", "s2", "หัวข้อ", "high"},
		},
		TabRules: {{"l1", "s1", "at", "เวลา", "at 9"}},
		TabExamples: {
			{"l1", "s1", "We meet at 9.", "เราพบกันตอน 9 โมง", "at 9"},
			{"l1", "s1", "We meet on Monday.", "", "in Monday"},
		},
		TabDrills: {
			{"l1", "s1", "Leave ___ 9.", "at", "on", "in", "by", "at", "เวลาเป๊ะใช้ at"},
			{"l1", "s1", "Leave ___ 9.", "at", "on", "in", "by", "for", "ผิด"},
			{"l1", "s1", "Leave at 9.", "at", "on", "in", "by", "at", "ไม่มีช่องว่าง"},
			{"l1", "s9", "Leave ___ 9.", "at", "on", "in", "by", "at", "หัวข้อไม่มี"},
		},
	}
	lessons, problems := Assemble(tables)
	if len(lessons) != 1 || len(lessons[0].Sections) != 1 {
		t.Fatalf("lessons = %+v", lessons)
	}
	l := lessons[0]
	if strings.Join(l.Analysis.Covers, "|") != "a|b" || len(l.Strategy) != 2 {
		t.Errorf("list cells: covers %q strategy %q", l.Analysis.Covers, l.Strategy)
	}
	s := l.Sections[0]
	if s.Priority != PriorityMedium {
		t.Errorf("bad priority should fall back to medium, got %q", s.Priority)
	}
	if len(s.Drills) != 1 || len(s.Examples) != 2 || len(s.Rules) != 1 {
		t.Errorf("drills %d examples %d rules %d, want 1, 2, 1", len(s.Drills), len(s.Examples), len(s.Rules))
	}
	// duplicate lesson, bad priority, unknown lesson, highlight not found,
	// answer not in options, no blank, unknown section
	if len(problems) != 7 {
		t.Errorf("got %d problems, want 7:\n%s", len(problems), strings.Join(problems, "\n"))
	}
	for _, want := range []string{"grammar_drills แถว 3", "grammar_lessons แถว 4", "ไม่อยู่ในตัวเลือก"} {
		if !strings.Contains(strings.Join(problems, "\n"), want) {
			t.Errorf("problems should mention %q:\n%s", want, strings.Join(problems, "\n"))
		}
	}
}
