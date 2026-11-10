package reading

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestShippedContentRoundTrip(t *testing.T) {
	c, err := ReadDir("../../data/reading")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Guides) != 2 || len(c.Sets) == 0 {
		t.Fatalf("guides %d sets %d", len(c.Guides), len(c.Sets))
	}
	got, problems := Assemble(Flatten(c))
	for _, p := range problems {
		t.Errorf("problem: %s", p)
	}
	want, _ := json.Marshal(c)
	have, _ := json.Marshal(got)
	if string(want) != string(have) {
		t.Errorf("round trip changed the content:\nwant %.300s\nhave %.300s", want, have)
	}
	perPart := map[int]int{}
	for _, s := range got.Sets {
		perPart[s.Part] += len(s.Questions)
		if s.Part == 6 && len(s.Questions) != 4 {
			t.Errorf("Part 6 set %s has %d questions; the test always has 4", s.ID, len(s.Questions))
		}
	}
	t.Logf("questions per part: %v", perPart)
}

func TestAssembleReportsProblems(t *testing.T) {
	tables := Tables{
		TabSets: {
			{"s6", "6", "Part 6 set"},
			{"s7", "7", "Part 7 set"},
			{"empty", "7", "No passages"},
			{"bad", "5", "Wrong part"},
		},
		TabPassages: {
			{"s6", "email", "", "Hello {{1}} and goodbye."},
			{"s7", "article", "", "One. [1] Two. [2] Three. [3]"},
		},
		TabQuestions: {
			{"s6", "grammar", "ช่องที่ 1", "a", "b", "c", "d", "a", "เพราะ"},
			{"s6", "grammar", "ช่องที่ 2", "a", "b", "c", "d", "a", "เพราะ"},
			{"s7", "insert", "Where?", "[1]", "[2]", "[3]", "[4]", "[2]", "เพราะ"},
			{"s7", "detail", "What?", "a", "b", "c", "d", "e", "คำตอบไม่อยู่ในตัวเลือก"},
			{"s7", "guess", "What?", "a", "b", "c", "d", "a", "ประเภทไม่รู้จัก"},
		},
	}
	c, problems := Assemble(tables)
	if len(c.Sets) != 2 {
		t.Fatalf("sets = %d, want 2 (empty and wrong-part sets dropped)", len(c.Sets))
	}
	if len(c.Sets[0].Questions) != 2 || len(c.Sets[1].Questions) != 1 {
		t.Errorf("questions: %d and %d, want 2 and 1", len(c.Sets[0].Questions), len(c.Sets[1].Questions))
	}
	all := strings.Join(problems, "\n")
	for _, want := range []string{"part ของชุด \"bad\"", "ไม่อยู่ในตัวเลือก", "\"guess\"", "{{2}}", "[4]", "\"empty\""} {
		if !strings.Contains(all, want) {
			t.Errorf("problems should mention %s:\n%s", want, all)
		}
	}
}
