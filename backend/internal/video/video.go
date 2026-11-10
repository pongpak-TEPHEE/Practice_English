// Package video holds YouTube videos with timed English subtitles and Thai
// translations, used to practise listening by typing what is said.
//
// The learner edits two tabs by hand, so columns are found by their header
// name (row 1), not their position, and extra columns are ignored:
//
//	Videos:      video_id | title | category | difficulty
//	Transcripts: video_id | order_index | start_sec | end_sec | text_en | text_th
//
// video_id may be the 11-character id or a full YouTube link.
package video

import (
	"cmp"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"unicode"
)

const (
	TabVideos      = "Videos"
	TabTranscripts = "Transcripts"
)

var (
	VideosHeader      = []string{"video_id", "title", "category", "difficulty"}
	TranscriptsHeader = []string{"video_id", "order_index", "start_sec", "end_sec", "text_en", "text_th"}
)

// Tables holds each tab's rows including the header row.
type Tables map[string][][]string

type Line struct {
	Order int     `json:"order"`
	Start float64 `json:"start"` // seconds from the start of the video
	End   float64 `json:"end"`
	En    string  `json:"en"`
	Th    string  `json:"th"`
}

type Video struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Category   string `json:"category"`
	Difficulty string `json:"difficulty"`
	Lines      []Line `json:"lines"`
}

// Summary is a video without its lines, for the list page.
type Summary struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Category   string  `json:"category"`
	Difficulty string  `json:"difficulty"`
	Lines      int     `json:"lines"`
	Words      int     `json:"words"`  // words to type
	Length     float64 `json:"length"` // seconds from the first line's start to the last line's end
}

func (v Video) Summary() Summary {
	s := Summary{ID: v.ID, Title: v.Title, Category: v.Category, Difficulty: v.Difficulty, Lines: len(v.Lines)}
	for _, l := range v.Lines {
		s.Words += len(Words(l.En))
	}
	if n := len(v.Lines); n > 0 {
		s.Length = v.Lines[n-1].End - v.Lines[0].Start
	}
	return s
}

var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// ParseID accepts a bare video id or a YouTube link (watch, youtu.be, shorts, embed).
func ParseID(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if idPattern.MatchString(s) {
		return s, true
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return "", false
	}
	host := strings.TrimPrefix(strings.TrimPrefix(u.Hostname(), "www."), "m.")
	var id string
	switch host {
	case "youtu.be":
		id = strings.Trim(u.Path, "/")
	case "youtube.com", "music.youtube.com":
		if v := u.Query().Get("v"); v != "" {
			id = v
		} else if parts := strings.Split(strings.Trim(u.Path, "/"), "/"); len(parts) == 2 &&
			(parts[0] == "shorts" || parts[0] == "embed" || parts[0] == "live") {
			id = parts[1]
		}
	}
	return id, idPattern.MatchString(id)
}

// Words splits a subtitle line into the words to type. Parts in brackets are
// labels or backing vocals, e.g. "(Ariana)" or "(side to side)", and are left
// out unless the whole line is in brackets.
func Words(text string) []string {
	main := strings.TrimSpace(bracketed.ReplaceAllString(text, " "))
	if Key(main) == "" {
		main = strings.NewReplacer("(", " ", ")", " ", "[", " ", "]", " ").Replace(text)
	}
	var out []string
	for _, w := range strings.Fields(main) {
		if Key(w) != "" {
			out = append(out, w)
		}
	}
	return out
}

var bracketed = regexp.MustCompile(`\([^)]*\)|\[[^\]]*\]`)

// Key is how typed words are compared: lower case, letters and digits only,
// so "I've", "ive" and "Ive" all match. The frontend uses the same rule.
func Key(word string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(word) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Assemble builds videos from the two tabs. Rows that can't be used are left
// out and described in problems with their tab and row number, so one typo
// never hides the rest. Videos keep sheet order; lines are sorted by order_index.
func Assemble(t Tables) (videos []Video, problems []string) {
	report := func(tab string, row int, format string, args ...any) {
		problems = append(problems, fmt.Sprintf("%s แถว %d: ", tab, row)+fmt.Sprintf(format, args...))
	}
	videos = []Video{}

	vcol, missing := columns(t[TabVideos], VideosHeader[:2])
	if missing != "" {
		problems = append(problems, fmt.Sprintf("%s: ไม่พบคอลัมน์ %s ในแถวที่ 1", TabVideos, missing))
		return videos, problems
	}
	at := map[string]int{}
	for i, row := range body(t[TabVideos]) {
		if isBlank(row) {
			continue
		}
		n := i + 2
		raw := get(row, vcol, "video_id")
		id, ok := ParseID(raw)
		switch {
		case !ok:
			report(TabVideos, n, "video_id %q ไม่ใช่รหัสหรือลิงก์ YouTube", raw)
			continue
		case get(row, vcol, "title") == "":
			report(TabVideos, n, "ต้องมี title")
			continue
		}
		if _, dup := at[id]; dup {
			report(TabVideos, n, "video_id %s ซ้ำกับแถวก่อนหน้า", id)
			continue
		}
		at[id] = len(videos)
		videos = append(videos, Video{ID: id, Title: get(row, vcol, "title"),
			Category: get(row, vcol, "category"), Difficulty: get(row, vcol, "difficulty"), Lines: []Line{}})
	}

	tcol, missing := columns(t[TabTranscripts], TranscriptsHeader[:5])
	if missing != "" {
		problems = append(problems, fmt.Sprintf("%s: ไม่พบคอลัมน์ %s ในแถวที่ 1", TabTranscripts, missing))
		return []Video{}, problems
	}
	type numbered struct {
		Line
		row int
	}
	lines := map[string][]numbered{}
	for i, row := range body(t[TabTranscripts]) {
		if isBlank(row) {
			continue
		}
		n := i + 2
		raw := get(row, tcol, "video_id")
		id, _ := ParseID(raw)
		if _, ok := at[id]; !ok {
			report(TabTranscripts, n, "ไม่พบ video_id %q ในแท็บ %s", raw, TabVideos)
			continue
		}
		order, err1 := strconv.Atoi(get(row, tcol, "order_index"))
		start, err2 := strconv.ParseFloat(get(row, tcol, "start_sec"), 64)
		end, err3 := strconv.ParseFloat(get(row, tcol, "end_sec"), 64)
		en := get(row, tcol, "text_en")
		switch {
		case err1 != nil:
			report(TabTranscripts, n, "order_index ต้องเป็นจำนวนเต็ม")
			continue
		case err2 != nil || err3 != nil:
			report(TabTranscripts, n, "start_sec และ end_sec ต้องเป็นตัวเลข (วินาที)")
			continue
		case start < 0 || end <= start:
			report(TabTranscripts, n, "end_sec (%g) ต้องมากกว่า start_sec (%g)", end, start)
			continue
		case len(Words(en)) == 0:
			report(TabTranscripts, n, "text_en ว่าง")
			continue
		}
		lines[id] = append(lines[id], numbered{Line{order, start, end, en, get(row, tcol, "text_th")}, n})
	}

	kept := videos[:0]
	for _, v := range videos {
		ls := lines[v.ID]
		slices.SortStableFunc(ls, func(a, b numbered) int { return cmp.Compare(a.Order, b.Order) })
		for i, l := range ls {
			switch {
			case i > 0 && l.Order == ls[i-1].Order:
				report(TabTranscripts, l.row, "order_index %d ของวิดีโอ %s ซ้ำ", l.Order, v.ID)
				continue
			case len(v.Lines) > 0 && l.Start < v.Lines[len(v.Lines)-1].Start:
				// A line that starts before the one above it is almost always a typo in the time.
				report(TabTranscripts, l.row, "start_sec %g เร็วกว่าบรรทัดก่อนหน้า ตรวจเวลาอีกครั้ง", l.Start)
				continue
			}
			v.Lines = append(v.Lines, l.Line)
		}
		if len(v.Lines) == 0 {
			problems = append(problems, fmt.Sprintf("%s: วิดีโอ %s ยังไม่มีซับใน %s จึงยังไม่แสดง", TabVideos, v.ID, TabTranscripts))
			continue
		}
		kept = append(kept, v)
	}
	return kept, problems
}

// Flatten turns videos into the two tabs, header rows included.
func Flatten(videos []Video) Tables {
	t := Tables{TabVideos: {VideosHeader}, TabTranscripts: {TranscriptsHeader}}
	num := func(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }
	for _, v := range videos {
		t[TabVideos] = append(t[TabVideos], []string{v.ID, v.Title, v.Category, v.Difficulty})
		for _, l := range v.Lines {
			t[TabTranscripts] = append(t[TabTranscripts],
				[]string{v.ID, strconv.Itoa(l.Order), num(l.Start), num(l.End), l.En, l.Th})
		}
	}
	return t
}

// columns maps header names (case and spaces ignored) to their positions and
// names the first required column that is missing.
func columns(rows [][]string, required []string) (map[string]int, string) {
	col := map[string]int{}
	if len(rows) > 0 {
		for i, h := range rows[0] {
			name := strings.ReplaceAll(strings.ToLower(strings.TrimSpace(h)), " ", "_")
			if _, seen := col[name]; !seen && name != "" {
				col[name] = i
			}
		}
	}
	for _, r := range required {
		if _, ok := col[r]; !ok {
			return col, r
		}
	}
	return col, ""
}

func body(rows [][]string) [][]string {
	if len(rows) < 2 {
		return nil
	}
	return rows[1:]
}

func get(row []string, col map[string]int, name string) string {
	i, ok := col[name]
	if !ok || i >= len(row) {
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
