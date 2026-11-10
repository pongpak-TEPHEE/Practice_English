// Package reading holds TOEIC Reading Part 6 and Part 7 practice sets.
//
// A set is one or more passages (an e-mail, a notice, a text-message chain, ...)
// with the questions about them. In Part 6 the passage body marks each blank
// as {{1}}, {{2}}, ... in question order; in Part 7 a sentence-insertion question
// needs the positions [1] [2] [3] [4] in the passage.
//
// Like the grammar lessons, sets live in the Google Sheet across a few tabs that
// reference each other by set_id, and rows appear in sheet order.
package reading

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

type Passage struct {
	Kind    string `json:"kind"`    // email, notice, text-chain, ... (see Kinds)
	Heading string `json:"heading"` // e.g. "To: ... / Subject: ..." or a title
	Body    string `json:"body"`
}

type Question struct {
	Type     string   `json:"type"` // see QuestionTypes
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Answer   string   `json:"answer"`
	Why      string   `json:"why"`
}

type Set struct {
	ID        string     `json:"id"`
	Part      int        `json:"part"`
	Title     string     `json:"title"`
	Passages  []Passage  `json:"passages"`
	Questions []Question `json:"questions"`
}

// Summary describes a set in the list without its content.
type Summary struct {
	ID        string   `json:"id"`
	Part      int      `json:"part"`
	Title     string   `json:"title"`
	Kinds     []string `json:"kinds"`
	Questions int      `json:"questions"`
}

func (s Set) Summarize() Summary {
	sum := Summary{ID: s.ID, Part: s.Part, Title: s.Title, Questions: len(s.Questions), Kinds: []string{}}
	for _, p := range s.Passages {
		sum.Kinds = append(sum.Kinds, p.Kind)
	}
	return sum
}

type Analysis struct {
	Parts      string   `json:"parts"`
	Questions  string   `json:"questions"`
	Points     string   `json:"points"`
	Covers     []string `json:"covers"`
	NotCovered []string `json:"notCovered"`
	Note       string   `json:"note"`
}

type QuestionType struct {
	Name string `json:"name"`
	How  string `json:"how"`
}

// Guide is the introduction to a part: what it is worth and how to answer it.
type Guide struct {
	Part          int            `json:"part"`
	Title         string         `json:"title"`
	Summary       string         `json:"summary"`
	Analysis      Analysis       `json:"analysis"`
	Strategy      []string       `json:"strategy"`
	QuestionTypes []QuestionType `json:"questionTypes"`
}

// Kinds of passage the app knows how to label.
var Kinds = []string{"email", "letter", "memo", "notice", "advertisement", "article", "text-chain", "form", "webpage", "schedule"}

// QuestionTypes the app knows how to label.
var QuestionTypes = []string{"grammar", "vocabulary", "transition", "sentence", // Part 6
	"purpose", "detail", "not", "inference", "synonym", "insert", "intent", "cross"} // Part 7

// ---- sheet layout ----

const (
	TabGuides    = "reading_guides"
	TabSets      = "reading_sets"
	TabPassages  = "reading_passages"
	TabQuestions = "reading_questions"
)

var Tabs = []struct {
	Name   string
	Header []string
}{
	{TabGuides, []string{"part", "title", "summary", "parts", "questions", "points", "covers", "not_covered", "note", "strategy", "question_types"}},
	{TabSets, []string{"set_id", "part", "title"}},
	{TabPassages, []string{"set_id", "kind", "heading", "body"}},
	{TabQuestions, []string{"set_id", "type", "question", "option_a", "option_b", "option_c", "option_d", "answer", "why"}},
}

// Tables is the flat form: the data rows of each tab, header excluded.
type Tables map[string][][]string

// Content is everything in the reading tabs.
type Content struct {
	Guides []Guide `json:"guides"`
	Sets   []Set   `json:"sets"`
}

// Flatten turns content into sheet rows.
func Flatten(c Content) Tables {
	t := Tables{}
	lines := func(items []string) string { return strings.Join(items, "\n") }
	for _, g := range c.Guides {
		a := g.Analysis
		types := make([]string, len(g.QuestionTypes))
		for i, qt := range g.QuestionTypes {
			types[i] = qt.Name + ": " + qt.How
		}
		t[TabGuides] = append(t[TabGuides], []string{strconv.Itoa(g.Part), g.Title, g.Summary, a.Parts, a.Questions, a.Points,
			lines(a.Covers), lines(a.NotCovered), a.Note, lines(g.Strategy), lines(types)})
	}
	for _, s := range c.Sets {
		t[TabSets] = append(t[TabSets], []string{s.ID, strconv.Itoa(s.Part), s.Title})
		for _, p := range s.Passages {
			t[TabPassages] = append(t[TabPassages], []string{s.ID, p.Kind, p.Heading, p.Body})
		}
		for _, q := range s.Questions {
			row := []string{s.ID, q.Type, q.Question}
			for i := range 4 {
				opt := ""
				if i < len(q.Options) {
					opt = q.Options[i]
				}
				row = append(row, opt)
			}
			t[TabQuestions] = append(t[TabQuestions], append(row, q.Answer, q.Why))
		}
	}
	return t
}

// Assemble rebuilds content from sheet rows. Rows that can't be used are left
// out and described in problems, with their tab and row number.
func Assemble(t Tables) (c Content, problems []string) {
	report := func(tab string, i int, format string, args ...any) {
		problems = append(problems, fmt.Sprintf("%s แถว %d: ", tab, i+2)+fmt.Sprintf(format, args...))
	}
	c = Content{Guides: []Guide{}, Sets: []Set{}}

	for i, row := range t[TabGuides] {
		if isBlank(row) {
			continue
		}
		part, err := strconv.Atoi(cell(row, 0))
		if err != nil || (part != 6 && part != 7) {
			report(TabGuides, i, "part ต้องเป็น 6 หรือ 7")
			continue
		}
		g := Guide{Part: part, Title: cell(row, 1), Summary: cell(row, 2),
			Analysis: Analysis{Parts: cell(row, 3), Questions: cell(row, 4), Points: cell(row, 5),
				Covers: splitLines(cell(row, 6)), NotCovered: splitLines(cell(row, 7)), Note: cell(row, 8)},
			Strategy: splitLines(cell(row, 9)), QuestionTypes: []QuestionType{}}
		for _, line := range splitLines(cell(row, 10)) {
			name, how, ok := strings.Cut(line, ": ")
			if !ok {
				report(TabGuides, i, "ประเภทคำถาม %q ต้องเขียนเป็น ชื่อ: คำอธิบาย", line)
				continue
			}
			g.QuestionTypes = append(g.QuestionTypes, QuestionType{Name: strings.TrimSpace(name), How: strings.TrimSpace(how)})
		}
		c.Guides = append(c.Guides, g)
	}

	at := map[string]int{}
	for i, row := range t[TabSets] {
		if isBlank(row) {
			continue
		}
		id := cell(row, 0)
		part, err := strconv.Atoi(cell(row, 1))
		switch {
		case id == "" || cell(row, 2) == "":
			report(TabSets, i, "ต้องมีทั้ง set_id และ title")
			continue
		case err != nil || (part != 6 && part != 7):
			report(TabSets, i, "part ของชุด %q ต้องเป็น 6 หรือ 7", id)
			continue
		}
		if _, dup := at[id]; dup {
			report(TabSets, i, "set_id %q ซ้ำ", id)
			continue
		}
		at[id] = len(c.Sets)
		c.Sets = append(c.Sets, Set{ID: id, Part: part, Title: cell(row, 2), Passages: []Passage{}, Questions: []Question{}})
	}

	set := func(tab string, i int, row []string) *Set {
		k, ok := at[cell(row, 0)]
		if !ok {
			report(tab, i, "ไม่พบชุด %q ในแท็บ %s", cell(row, 0), TabSets)
			return nil
		}
		return &c.Sets[k]
	}
	for i, row := range t[TabPassages] {
		if isBlank(row) {
			continue
		}
		if s := set(TabPassages, i, row); s != nil {
			p := Passage{Kind: cell(row, 1), Heading: cell(row, 2), Body: cell(row, 3)}
			if p.Body == "" {
				report(TabPassages, i, "ไม่มีเนื้อความ")
				continue
			}
			if !slices.Contains(Kinds, p.Kind) {
				report(TabPassages, i, "ประเภทเอกสาร %q ไม่รู้จัก (ใช้ได้: %s)", p.Kind, strings.Join(Kinds, ", "))
			}
			s.Passages = append(s.Passages, p)
		}
	}
	for i, row := range t[TabQuestions] {
		if isBlank(row) {
			continue
		}
		if s := set(TabQuestions, i, row); s != nil {
			q := Question{Type: cell(row, 1), Question: cell(row, 2),
				Options: []string{cell(row, 3), cell(row, 4), cell(row, 5), cell(row, 6)}, Answer: cell(row, 7), Why: cell(row, 8)}
			if msg := q.problem(); msg != "" {
				report(TabQuestions, i, "%s (ข้อนี้จะไม่แสดง)", msg)
				continue
			}
			s.Questions = append(s.Questions, q)
		}
	}

	// A set needs something to read and something to answer, and its markers
	// must match its questions.
	kept := c.Sets[:0]
	for _, s := range c.Sets {
		if len(s.Passages) == 0 || len(s.Questions) == 0 {
			problems = append(problems, fmt.Sprintf("ชุด %q ไม่มีเนื้อความหรือคำถาม (ชุดนี้จะไม่แสดง)", s.ID))
			continue
		}
		problems = append(problems, s.markerProblems()...)
		kept = append(kept, s)
	}
	c.Sets = kept
	return c, problems
}

func (q Question) problem() string {
	if !slices.Contains(QuestionTypes, q.Type) {
		return fmt.Sprintf("ประเภทคำถาม %q ไม่รู้จัก", q.Type)
	}
	seen := map[string]bool{}
	for _, o := range q.Options {
		if o == "" {
			return "ต้องมีตัวเลือกครบ 4 ตัว"
		}
		if seen[o] {
			return fmt.Sprintf("ตัวเลือก %q ซ้ำ", o)
		}
		seen[o] = true
	}
	if !seen[q.Answer] {
		return fmt.Sprintf("คำตอบ %q ไม่อยู่ในตัวเลือก", q.Answer)
	}
	if q.Why == "" {
		return "ไม่มีคำอธิบายเฉลย"
	}
	return ""
}

// markerProblems checks the {{n}} blanks of Part 6 and the [n] positions of
// Part 7 insertion questions.
func (s Set) markerProblems() []string {
	var body strings.Builder
	for _, p := range s.Passages {
		body.WriteString(p.Body + "\n")
	}
	text := body.String()
	var out []string
	if s.Part == 6 {
		for n := 1; n <= len(s.Questions); n++ {
			if strings.Count(text, fmt.Sprintf("{{%d}}", n)) != 1 {
				out = append(out, fmt.Sprintf("ชุด %q: เนื้อความต้องมีช่อง {{%d}} หนึ่งช่องพอดี", s.ID, n))
			}
		}
	}
	for _, q := range s.Questions {
		if q.Type != "insert" {
			continue
		}
		for n := 1; n <= 4; n++ {
			if !strings.Contains(text, fmt.Sprintf("[%d]", n)) {
				out = append(out, fmt.Sprintf("ชุด %q: คำถามแทรกประโยคต้องมีตำแหน่ง [%d] ในเนื้อความ", s.ID, n))
			}
		}
	}
	return out
}

// ReadDir loads every *.json file in dir; each holds a guide and its sets.
func ReadDir(dir string) (Content, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		return Content{}, err
	}
	slices.Sort(paths)
	c := Content{Guides: []Guide{}, Sets: []Set{}}
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			return Content{}, err
		}
		var file struct {
			Guide Guide `json:"guide"`
			Sets  []Set `json:"sets"`
		}
		if err := json.Unmarshal(b, &file); err != nil {
			return Content{}, fmt.Errorf("%s: %w", p, err)
		}
		c.Guides = append(c.Guides, file.Guide)
		c.Sets = append(c.Sets, file.Sets...)
	}
	return c, nil
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
