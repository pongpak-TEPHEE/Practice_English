package vocab

import (
	"regexp"
	"strings"
	"testing"
)

// Checks the word lists the app actually ships.
func TestShippedWordLists(t *testing.T) {
	words, err := ReadCSVFiles("../../data/oxford3000.csv", "../../data/toeic_service_list.csv")
	if err != nil {
		t.Fatal(err)
	}
	perLevel := map[string]int{}
	oxford := map[string]int{} // the Oxford 3000 has a few deliberate homographs (it/IT, may/May)
	for _, w := range words {
		if w.Level != "TOEIC" {
			oxford[strings.ToLower(w.Word)] = w.ID
		}
	}
	seenTOEIC := map[string]int{}
	for _, w := range words {
		perLevel[w.Level]++
		if LevelRank(w.Level) == len(Levels) {
			t.Errorf("word %d %q has unknown level %q", w.ID, w.Word, w.Level)
		}
		if strings.TrimSpace(w.MeaningTH) == "" || strings.TrimSpace(w.Example) == "" {
			t.Errorf("word %d %q is missing a meaning or example", w.ID, w.Word)
		}
		if w.Level == "TOEIC" {
			key := strings.ToLower(w.Word)
			if id, ok := oxford[key]; ok {
				t.Errorf("TOEIC word %q (id %d) is already in the Oxford 3000 (id %d)", w.Word, w.ID, id)
			}
			if id, ok := seenTOEIC[key]; ok {
				t.Errorf("TOEIC word %q appears twice (ids %d and %d)", w.Word, id, w.ID)
			}
			seenTOEIC[key] = w.ID
			if w.ID < 10001 {
				t.Errorf("TOEIC word %q has id %d; TOEIC ids start at 10001", w.Word, w.ID)
			}
			// The flashcard bolds the word in its example using this same rule.
			base := []rune(strings.ToLower(w.Word))
			stem := string(base)
			if len(base) > 4 {
				stem = string(base[:len(base)-2])
			}
			if !regexp.MustCompile(`(?i)(^|[^a-z])` + regexp.QuoteMeta(stem)).MatchString(w.Example) {
				t.Errorf("TOEIC word %q not found in its example %q", w.Word, w.Example)
			}
		}
	}
	if perLevel["TOEIC"] != 1058 {
		t.Errorf("TOEIC words = %d, want 1058", perLevel["TOEIC"])
	}
	t.Logf("words per level: %v", perLevel)
}
