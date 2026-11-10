package video

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
)

func TestParseID(t *testing.T) {
	for in, want := range map[string]string{
		"dT2owtxkU8k":   "dT2owtxkU8k",
		" dT2owtxkU8k ": "dT2owtxkU8k",
		"https://www.youtube.com/watch?v=dT2owtxkU8k&t=3": "dT2owtxkU8k",
		"https://youtu.be/dT2owtxkU8k?si=x":               "dT2owtxkU8k",
		"https://m.youtube.com/watch?v=dT2owtxkU8k":       "dT2owtxkU8k",
		"https://youtube.com/shorts/dT2owtxkU8k":          "dT2owtxkU8k",
		"https://www.youtube.com/embed/dT2owtxkU8k":       "dT2owtxkU8k",
	} {
		if got, ok := ParseID(in); !ok || got != want {
			t.Errorf("ParseID(%q) = %q, %v; want %q", in, got, ok, want)
		}
	}
	for _, bad := range []string{"", "short", "https://vimeo.com/dT2owtxkU8k", "https://www.youtube.com/watch?v=bad", "dT2owtxkU8k!"} {
		if got, ok := ParseID(bad); ok {
			t.Errorf("ParseID(%q) = %q, want rejected", bad, got)
		}
	}
}

func TestWords(t *testing.T) {
	cases := map[string][]string{
		"I've been here all night, (ariana)":                  {"I've", "been", "here", "all", "night,"},
		"And boy, got me walkin' side to side (side to side)": {"And", "boy,", "got", "me", "walkin'", "side", "to", "side"},
		"('bout nothin')":                       {"'bout", "nothin'"},
		"Can't hear them no, cause i...":        {"Can't", "hear", "them", "no,", "cause", "i..."},
		"All these bitches, flows - my mini-me": {"All", "these", "bitches,", "flows", "my", "mini-", "me"},
		"a part-time job -- level-five":         {"a", "part-", "time", "job", "level-", "five"},
		"  ":                                    nil,
	}
	for in, want := range cases {
		if got := Words(in); !reflect.DeepEqual(got, want) {
			t.Errorf("Words(%q) = %q, want %q", in, got, want)
		}
	}
	for in, want := range map[string]string{"I've": "ive", "'cause": "cause", "NIGHT,": "night", "mini-me": "minime", "i...": "i", "café": "café"} {
		if got := Key(in); got != want {
			t.Errorf("Key(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAssemble(t *testing.T) {
	tables := Tables{
		TabVideos: {
			{"Video_ID", "Title", "category", "difficulty", "notes"},
			{"dT2owtxkU8k", "Song A", "Music", "Medium", "extra column is ignored"},
			{"https://youtu.be/SXiSVQZLje8", "Song B", "Music", "Easy"},
			{"not a video", "Bad"},
			{"dT2owtxkU8k", "Duplicate"},
			{"AAAAAAAAAAA", "No lines yet"},
			{},
		},
		TabTranscripts: {
			{"video_id", "order_index", "start_sec", "end_sec", "text_en", "text_th"},
			{"dT2owtxkU8k", "2", "37.47", "41.43", "I think about her", "ฉันคิดถึงเธอ"},
			{"dT2owtxkU8k", "1", "34.07", "37.43", "I wanna follow where she goes", "ฉันอยากตามเธอไป"},
			{"SXiSVQZLje8", "1", "1.23", "3.2", "I've been here all night"},
			{"dT2owtxkU8k", "3", "x", "45", "bad time"},
			{"dT2owtxkU8k", "4", "50", "49", "end before start"},
			{"dT2owtxkU8k", "2", "60", "61", "duplicate order"},
			{"dT2owtxkU8k", "5", "10", "12", "starts before the line above"},
			{"zzzzzzzzzzz", "1", "1", "2", "unknown video"},
			{"SXiSVQZLje8", "2", "4", "5", "(ariana)"},
			{"SXiSVQZLje8", "3", "6", "7", "..."},
		},
	}
	videos, problems := Assemble(tables)
	if len(videos) != 2 || videos[0].ID != "dT2owtxkU8k" || videos[1].ID != "SXiSVQZLje8" {
		t.Fatalf("videos = %+v", videos)
	}
	a := videos[0]
	if len(a.Lines) != 2 || a.Lines[0].Order != 1 || a.Lines[1].En != "I think about her" || a.Lines[0].Th != "ฉันอยากตามเธอไป" {
		t.Errorf("lines of A = %+v", a.Lines)
	}
	if b := videos[1]; len(b.Lines) != 2 || b.Lines[0].Th != "" || b.Difficulty != "Easy" {
		t.Errorf("video B = %+v", b)
	}
	want := []string{
		"Videos แถว 4", "Videos แถว 5", "Transcripts แถว 5", "Transcripts แถว 6",
		"Transcripts แถว 9", "Transcripts แถว 11", "Transcripts แถว 7", "Transcripts แถว 8", "AAAAAAAAAAA",
	}
	if len(problems) != len(want) {
		t.Fatalf("problems = %q", problems)
	}
	for _, w := range want {
		if !mentions(problems, w) {
			t.Errorf("no problem mentions %q in %q", w, problems)
		}
	}

	s := a.Summary()
	if s.Lines != 2 || s.Words != 10 || s.Length < 7.35 || s.Length > 7.37 {
		t.Errorf("summary = %+v", s)
	}

	// Flatten and Assemble round-trip.
	again, problems := Assemble(Flatten(videos))
	if len(problems) != 0 || !reflect.DeepEqual(again, videos) {
		t.Errorf("round trip changed videos: %v\n%+v\n%+v", problems, again, videos)
	}
}

func TestAssembleMissingColumn(t *testing.T) {
	videos, problems := Assemble(Tables{TabVideos: {{"id", "title"}}, TabTranscripts: {TranscriptsHeader}})
	if len(videos) != 0 || len(problems) != 1 || !strings.Contains(problems[0], "video_id") {
		t.Errorf("videos %v problems %q", videos, problems)
	}
	videos, problems = Assemble(Tables{})
	if len(videos) != 0 || len(problems) != 1 {
		t.Errorf("empty tables: videos %v problems %q", videos, problems)
	}
}

func TestResultRoundTripAndValidate(t *testing.T) {
	r := Result{Date: "2026-11-10", Time: "21:00", VideoID: "dT2owtxkU8k", Mode: ModeDictation, LinesDone: 10, LinesTotal: 49,
		WordsCorrect: 40, WordsTotal: 52, Replays: 7, Seconds: 300, Missed: []string{"gonna", "inhibitions"}}
	if err := r.Validate(); err != nil {
		t.Fatal(err)
	}
	cells := make([]string, len(ResultRow(r)))
	for i, c := range ResultRow(r) {
		cells[i] = fmt.Sprint(c)
	}
	got, err := ParseResultRow(cells)
	if err != nil || !reflect.DeepEqual(got, r) {
		t.Errorf("round trip = %+v, %v", got, err)
	}

	bad := []func(*Result){
		func(r *Result) { r.VideoID = "x" },
		func(r *Result) { r.Mode = "watch" },
		func(r *Result) { r.LinesDone = 50 },
		func(r *Result) { r.LinesDone = 0 },
		func(r *Result) { r.WordsCorrect = 53 },
		func(r *Result) { r.Seconds = 0 },
		func(r *Result) { r.Replays = -1 },
		func(r *Result) { r.Missed = []string{"a, b"} },
		func(r *Result) { r.Missed = make([]string, 13) },
	}
	for i, change := range bad {
		c := r
		change(&c)
		if c.Validate() == nil {
			t.Errorf("case %d: %+v should be rejected", i, c)
		}
	}
}

func mentions(list []string, part string) bool {
	for _, s := range list {
		if strings.Contains(s, part) {
			return true
		}
	}
	return false
}
