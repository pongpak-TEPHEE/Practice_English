// Package grammar holds the grammar lessons and their sheet layout.
//
// A lesson is nested (lesson → sections → rules, examples, drills), but a
// spreadsheet is flat, so lessons are stored in five tabs that reference each
// other by id. Rows appear in the app in the same order as in the sheet, and
// list cells (covers, not covered, strategy) hold one item per line.
package grammar

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type Rule struct {
	Word     string `json:"word"`
	Use      string `json:"use"`
	Examples string `json:"examples"`
}

type Example struct {
	EN   string `json:"en"`
	TH   string `json:"th"`
	Mark string `json:"mark"` // the part of EN to highlight
}

// Drill is a Part 5-style question: one blank ("___") and four options.
type Drill struct {
	Sentence string   `json:"sentence"`
	Options  []string `json:"options"`
	Answer   string   `json:"answer"`
	Why      string   `json:"why"`
}

// Priority says how often a topic shows up on the test.
const (
	PriorityHigh   = "high"
	PriorityMedium = "medium"
	PriorityBasic  = "basic"
)

type Section struct {
	ID       string    `json:"id"`
	Title    string    `json:"title"`
	Priority string    `json:"priority"`
	Intro    string    `json:"intro"`
	Rules    []Rule    `json:"rules"`
	Examples []Example `json:"examples"`
	Tip      string    `json:"tip,omitempty"`
	Drills   []Drill   `json:"drills"`
}

// Analysis states what a lesson is worth on the test.
type Analysis struct {
	Parts      string   `json:"parts"`
	Questions  string   `json:"questions"`
	Points     string   `json:"points"`
	Covers     []string `json:"covers"`
	NotCovered []string `json:"notCovered"`
	Note       string   `json:"note"`
}

type Lesson struct {
	ID       string    `json:"id"`
	Title    string    `json:"title"`
	English  string    `json:"english"`
	Summary  string    `json:"summary"`
	Analysis Analysis  `json:"analysis"`
	Strategy []string  `json:"strategy"`
	Sections []Section `json:"sections"`
}

// Summary is a lesson without its content, for the lesson list.
type Summary struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	English  string `json:"english"`
	Summary  string `json:"summary"`
	Sections int    `json:"sections"`
	Drills   int    `json:"drills"`
}

func (l Lesson) Summarize() Summary {
	s := Summary{ID: l.ID, Title: l.Title, English: l.English, Summary: l.Summary, Sections: len(l.Sections)}
	for _, sec := range l.Sections {
		s.Drills += len(sec.Drills)
	}
	return s
}

// ---- sheet layout ----

const (
	TabLessons  = "grammar_lessons"
	TabSections = "grammar_sections"
	TabRules    = "grammar_rules"
	TabExamples = "grammar_examples"
	TabDrills   = "grammar_drills"
)

// Tabs lists the grammar tabs with their header rows, in load order.
var Tabs = []struct {
	Name   string
	Header []string
}{
	{TabLessons, []string{"lesson_id", "title", "english", "summary", "parts", "questions", "points", "covers", "not_covered", "note", "strategy"}},
	{TabSections, []string{"lesson_id", "section_id", "title", "priority", "intro", "tip"}},
	{TabRules, []string{"lesson_id", "section_id", "word", "use", "examples"}},
	{TabExamples, []string{"lesson_id", "section_id", "en", "th", "mark"}},
	{TabDrills, []string{"lesson_id", "section_id", "sentence", "option_a", "option_b", "option_c", "option_d", "answer", "why"}},
}

// Tables is the flat form of lessons: the data rows of each tab, header excluded.
type Tables map[string][][]string

// Flatten turns lessons into sheet rows.
func Flatten(lessons []Lesson) Tables {
	t := Tables{}
	lines := func(items []string) string { return strings.Join(items, "\n") }
	for _, l := range lessons {
		a := l.Analysis
		t[TabLessons] = append(t[TabLessons], []string{l.ID, l.Title, l.English, l.Summary,
			a.Parts, a.Questions, a.Points, lines(a.Covers), lines(a.NotCovered), a.Note, lines(l.Strategy)})
		for _, s := range l.Sections {
			t[TabSections] = append(t[TabSections], []string{l.ID, s.ID, s.Title, s.Priority, s.Intro, s.Tip})
			for _, r := range s.Rules {
				t[TabRules] = append(t[TabRules], []string{l.ID, s.ID, r.Word, r.Use, r.Examples})
			}
			for _, e := range s.Examples {
				t[TabExamples] = append(t[TabExamples], []string{l.ID, s.ID, e.EN, e.TH, e.Mark})
			}
			for _, d := range s.Drills {
				row := []string{l.ID, s.ID, d.Sentence}
				for i := range 4 {
					opt := ""
					if i < len(d.Options) {
						opt = d.Options[i]
					}
					row = append(row, opt)
				}
				t[TabDrills] = append(t[TabDrills], append(row, d.Answer, d.Why))
			}
		}
	}
	return t
}

// Assemble rebuilds lessons from sheet rows. Rows that can't be used (an unknown
// lesson or section, a drill whose answer isn't among its options, ...) are
// left out and described in problems, so one typo in the sheet hides one row
// instead of breaking the app.
func Assemble(t Tables) (lessons []Lesson, problems []string) {
	report := func(tab string, i int, format string, args ...any) {
		problems = append(problems, fmt.Sprintf("%s แถว %d: ", tab, i+2)+fmt.Sprintf(format, args...))
	}
	lessonAt := map[string]int{}
	for i, row := range t[TabLessons] {
		id := cell(row, 0)
		switch {
		case id == "" && isBlank(row):
			continue
		case id == "":
			report(TabLessons, i, "ไม่มี lesson_id")
			continue
		case cell(row, 1) == "":
			report(TabLessons, i, "บท %q ไม่มี title", id)
			continue
		}
		if _, dup := lessonAt[id]; dup {
			report(TabLessons, i, "lesson_id %q ซ้ำ", id)
			continue
		}
		lessonAt[id] = len(lessons)
		lessons = append(lessons, Lesson{
			ID: id, Title: cell(row, 1), English: cell(row, 2), Summary: cell(row, 3),
			Analysis: Analysis{
				Parts: cell(row, 4), Questions: cell(row, 5), Points: cell(row, 6),
				Covers: splitLines(cell(row, 7)), NotCovered: splitLines(cell(row, 8)), Note: cell(row, 9),
			},
			Strategy: splitLines(cell(row, 10)),
			Sections: []Section{},
		})
	}

	type key struct{ lesson, section string }
	sectionAt := map[key][2]int{} // lesson index, section index
	for i, row := range t[TabSections] {
		if isBlank(row) {
			continue
		}
		lid, sid := cell(row, 0), cell(row, 1)
		li, ok := lessonAt[lid]
		switch {
		case !ok:
			report(TabSections, i, "ไม่พบบท %q ในแท็บ %s", lid, TabLessons)
			continue
		case sid == "" || cell(row, 2) == "":
			report(TabSections, i, "ต้องมีทั้ง section_id และ title")
			continue
		}
		if _, dup := sectionAt[key{lid, sid}]; dup {
			report(TabSections, i, "section_id %q ซ้ำในบท %q", sid, lid)
			continue
		}
		priority := cell(row, 3)
		if !slices.Contains([]string{PriorityHigh, PriorityMedium, PriorityBasic}, priority) {
			report(TabSections, i, "priority %q ต้องเป็น high, medium หรือ basic (ใช้ medium แทน)", priority)
			priority = PriorityMedium
		}
		l := &lessons[li]
		sectionAt[key{lid, sid}] = [2]int{li, len(l.Sections)}
		l.Sections = append(l.Sections, Section{
			ID: sid, Title: cell(row, 2), Priority: priority, Intro: cell(row, 4), Tip: cell(row, 5),
			Rules: []Rule{}, Examples: []Example{}, Drills: []Drill{},
		})
	}

	// section finds the section a child row belongs to.
	section := func(tab string, i int, row []string) *Section {
		at, ok := sectionAt[key{cell(row, 0), cell(row, 1)}]
		if !ok {
			report(tab, i, "ไม่พบหัวข้อ %q ของบท %q ในแท็บ %s", cell(row, 1), cell(row, 0), TabSections)
			return nil
		}
		return &lessons[at[0]].Sections[at[1]]
	}

	for i, row := range t[TabRules] {
		if isBlank(row) {
			continue
		}
		if s := section(TabRules, i, row); s != nil {
			if cell(row, 2) == "" {
				report(TabRules, i, "ไม่มีคำในช่อง word")
				continue
			}
			s.Rules = append(s.Rules, Rule{Word: cell(row, 2), Use: cell(row, 3), Examples: cell(row, 4)})
		}
	}
	for i, row := range t[TabExamples] {
		if isBlank(row) {
			continue
		}
		if s := section(TabExamples, i, row); s != nil {
			e := Example{EN: cell(row, 2), TH: cell(row, 3), Mark: cell(row, 4)}
			if e.EN == "" {
				report(TabExamples, i, "ไม่มีประโยคภาษาอังกฤษ")
				continue
			}
			if e.Mark != "" && !strings.Contains(strings.ToLower(e.EN), strings.ToLower(e.Mark)) {
				// Still usable; the sentence just shows without a highlight.
				report(TabExamples, i, "ไม่พบคำที่จะไฮไลต์ %q ในประโยค", e.Mark)
			}
			s.Examples = append(s.Examples, e)
		}
	}
	for i, row := range t[TabDrills] {
		if isBlank(row) {
			continue
		}
		if s := section(TabDrills, i, row); s != nil {
			d := Drill{Sentence: cell(row, 2), Options: []string{cell(row, 3), cell(row, 4), cell(row, 5), cell(row, 6)},
				Answer: cell(row, 7), Why: cell(row, 8)}
			if msg := d.problem(); msg != "" {
				report(TabDrills, i, "%s (ข้อนี้จะไม่แสดง)", msg)
				continue
			}
			s.Drills = append(s.Drills, d)
		}
	}
	return lessons, problems
}

// problem describes why a drill can't be used, or returns "".
func (d Drill) problem() string {
	if strings.Count(d.Sentence, "___") != 1 {
		return "ประโยคต้องมีช่องว่าง ___ หนึ่งช่องพอดี"
	}
	seen := map[string]bool{}
	for _, o := range d.Options {
		if o == "" {
			return "ต้องมีตัวเลือกครบ 4 ตัว"
		}
		if seen[o] {
			return fmt.Sprintf("ตัวเลือก %q ซ้ำ", o)
		}
		seen[o] = true
	}
	if !seen[d.Answer] {
		return fmt.Sprintf("คำตอบ %q ไม่อยู่ในตัวเลือก", d.Answer)
	}
	if d.Why == "" {
		return "ไม่มีคำอธิบายเฉลย"
	}
	return ""
}

// ReadDir loads every *.json lesson in dir, in file-name order.
func ReadDir(dir string) ([]Lesson, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		return nil, err
	}
	slices.Sort(paths)
	lessons := []Lesson{}
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		var l Lesson
		if err := json.Unmarshal(b, &l); err != nil {
			return nil, fmt.Errorf("%s: %w", p, err)
		}
		lessons = append(lessons, l)
	}
	return lessons, nil
}

func cell(row []string, i int) string {
	if i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func isBlank(row []string) bool {
	for _, c := range row {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

func splitLines(s string) []string {
	out := []string{}
	for _, line := range strings.Split(s, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			out = append(out, line)
		}
	}
	return out
}
