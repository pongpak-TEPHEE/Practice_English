package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/memstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/study"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

const token = "secret"

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	store := memstore.New(vocab.SampleWords())
	store.SetGrammar(grammar.Tables{
		grammar.TabLessons:  {{"time", "เวลา", "Time", "at / on / in"}},
		grammar.TabSections: {{"time", "clock", "เวลาเป๊ะ", "high", "ใช้ at"}},
		grammar.TabDrills: {
			{"time", "clock", "Leave ___ 9.", "at", "on", "in", "by", "at", "เวลาเป๊ะใช้ at"},
			{"time", "clock", "Leave ___ 9.", "at", "on", "in", "by", "for", "คำตอบไม่อยู่ในตัวเลือก"},
		},
	})
	store.SetReading(reading.Tables{
		reading.TabSets:      {{"r1", "7", "Notice"}},
		reading.TabPassages:  {{"r1", "notice", "Notice", "The office closes at noon on Friday."}},
		reading.TabQuestions: {{"r1", "detail", "When does the office close?", "At noon", "At 5 P.M.", "On Monday", "Never", "At noon", "เพราะ"}},
	})
	svc, err := study.NewService(context.Background(), store, time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(NewHandler(svc, Options{
		APIToken:       token,
		AllowedOrigins: []string{"http://localhost:5173"},
		Logger:         slog.New(slog.NewTextHandler(io.Discard, nil)),
	}))
	t.Cleanup(srv.Close)
	return srv
}

func call(t *testing.T, srv *httptest.Server, method, path, body string, out any) int {
	t.Helper()
	req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if out != nil && resp.StatusCode < 300 {
		if err := json.Unmarshal(b, out); err != nil {
			t.Fatalf("%s %s: %v: %s", method, path, err, b)
		}
	}
	return resp.StatusCode
}

func TestAuthAndCORS(t *testing.T) {
	srv := newServer(t)
	resp, _ := http.Get(srv.URL + "/api/stats")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no token: status %d, want 401", resp.StatusCode)
	}
	req, _ := http.NewRequest("OPTIONS", srv.URL+"/api/settings", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	resp, _ = http.DefaultClient.Do(req)
	if resp.StatusCode != http.StatusNoContent || !strings.Contains(resp.Header.Get("Access-Control-Allow-Methods"), "PUT") {
		t.Errorf("preflight: status %d, methods %q", resp.StatusCode, resp.Header.Get("Access-Control-Allow-Methods"))
	}
}

func TestDailyFlow(t *testing.T) {
	srv := newServer(t)

	var s study.Settings
	if code := call(t, srv, "PUT", "/api/settings", `{"newPerDay":2,"roundsPerDay":2,"level":"A2"}`, &s); code != 200 {
		t.Fatalf("put settings: %d", code)
	}
	if s.NewPerDay != 2 || s.Level != "A2" || s.Accent != "us" {
		t.Fatalf("settings = %+v", s)
	}
	if code := call(t, srv, "PUT", "/api/settings", `{"level":"C1"}`, nil); code != 400 {
		t.Errorf("invalid level: status %d, want 400", code)
	}

	var today study.Today
	call(t, srv, "GET", "/api/today", "", &today)
	if len(today.NewQueue) != 2 || today.NewQueue[0].Level != "A2" {
		t.Fatalf("new queue = %+v", today.NewQueue)
	}
	a, b := today.NewQueue[0].ID, today.NewQueue[1].ID

	answer := func(id int, result, mode string) study.WordView {
		var v study.WordView
		body := `{"wordId":` + itoa(id) + `,"result":"` + result + `","mode":"` + mode + `"}`
		if code := call(t, srv, "POST", "/api/answer", body, &v); code != 200 {
			t.Fatalf("answer %s: %d", body, code)
		}
		return v
	}
	if v := answer(a, "fail", "learn"); v.Status != vocab.StatusNew {
		t.Errorf("failed new word status = %s, want new", v.Status)
	}
	answer(a, "pass", "learn")
	answer(b, "pass", "learn")

	call(t, srv, "GET", "/api/today", "", &today)
	if today.LearnedToday != 2 || len(today.NewQueue) != 0 || today.RoundsDone != 0 || len(today.RoundQueue) != 2 {
		t.Fatalf("after learning: %+v", today)
	}
	call(t, srv, "GET", "/api/today?extra=3", "", &today)
	if len(today.NewQueue) != 3 {
		t.Errorf("extra=3: %d new words, want 3", len(today.NewQueue))
	}

	answer(a, "pass", "review")
	call(t, srv, "GET", "/api/today", "", &today)
	if today.RoundsDone != 0 || len(today.RoundQueue) != 1 || today.RoundQueue[0].ID != b {
		t.Fatalf("mid round: done %d, queue %+v", today.RoundsDone, today.RoundQueue)
	}
	answer(b, "fail", "review")
	call(t, srv, "GET", "/api/today", "", &today)
	if today.RoundsDone != 1 || len(today.RoundQueue) != 2 {
		t.Fatalf("after round 1: %+v", today)
	}

	var fav study.WordView
	if code := call(t, srv, "PUT", "/api/words/7/favorite", `{"favorite":true}`, &fav); code != 200 || !fav.Progress.Favorite {
		t.Fatalf("favorite: %d %+v", code, fav)
	}
	var words []study.WordView
	call(t, srv, "GET", "/api/words?deck=favorites", "", &words)
	if len(words) != 1 || words[0].ID != 7 {
		t.Errorf("favorites deck = %+v", words)
	}
	call(t, srv, "GET", "/api/words?deck=learned", "", &words)
	if len(words) != 2 {
		t.Errorf("learned deck has %d words, want 2", len(words))
	}
	if code := call(t, srv, "GET", "/api/words?deck=nope", "", nil); code != 400 {
		t.Errorf("bad deck: status %d", code)
	}

	var st study.Stats
	call(t, srv, "GET", "/api/stats", "", &st)
	if st.Total != 10 || st.New != 8 || st.Learning != 2 || st.Favorites != 1 {
		t.Errorf("stats = %+v", st)
	}

	var hist []study.Day
	call(t, srv, "GET", "/api/history", "", &hist)
	if len(hist) != 1 || len(hist[0].Learned) != 2 || len(hist[0].Reviewed) != 2 {
		t.Fatalf("history = %+v", hist)
	}
	if l := hist[0].Learned[0]; l.WordID != a || l.Passes != 1 || l.Fails != 1 {
		t.Errorf("history learned[0] = %+v", l)
	}
	call(t, srv, "GET", "/api/history?level=B2", "", &hist)
	if len(hist) != 0 {
		t.Errorf("history B2 = %+v", hist)
	}

	call(t, srv, "PUT", "/api/settings", `{"reviewPerDay":2}`, nil)
	var ach study.Achievements
	call(t, srv, "GET", "/api/achievements", "", &ach)
	if ach.Today.New != 2 || ach.Today.Reviewed != 2 || !ach.Today.Met || ach.Streak != 1 || len(ach.Recent) != 14 {
		t.Errorf("achievements = %+v", ach)
	}

	for body, want := range map[string]int{
		`{"wordId":1,"result":"good"}`:               400,
		`{"wordId":1,"result":"pass","mode":"cram"}`: 400,
		`{"wordId":999,"result":"pass"}`:             404,
		`not json`:                                   400,
	} {
		if code := call(t, srv, "POST", "/api/answer", body, nil); code != want {
			t.Errorf("POST %s: status %d, want %d", body, code, want)
		}
	}
}

func TestAnswerBatch(t *testing.T) {
	srv := newServer(t)

	// Validation happens before anything is saved.
	for body, want := range map[string]int{
		`{"mode":"learn","answers":[]}`: 400,
		`{"mode":"learn","answers":[{"wordId":1,"result":"pass"},{"wordId":2,"result":"meh"}]}`:    400,
		`{"mode":"learn","answers":[{"wordId":1,"result":"pass"},{"wordId":999,"result":"pass"}]}`: 404,
	} {
		if code := call(t, srv, "POST", "/api/answers", body, nil); code != want {
			t.Errorf("POST %s: status %d, want %d", body, code, want)
		}
	}
	var words []study.WordView
	call(t, srv, "GET", "/api/words?deck=learned", "", &words)
	if len(words) != 0 {
		t.Fatalf("rejected batches saved progress: %+v", words)
	}

	var views []study.WordView
	body := `{"mode":"learn","answers":[{"wordId":1,"result":"fail"},{"wordId":2,"result":"pass"},{"wordId":1,"result":"pass"}]}`
	if code := call(t, srv, "POST", "/api/answers", body, &views); code != 200 {
		t.Fatalf("batch: status %d", code)
	}
	if len(views) != 2 || views[0].ID != 1 || views[1].ID != 2 {
		t.Fatalf("views = %+v", views)
	}
	if p := views[0].Progress; p.PassCount != 1 || p.FailCount != 1 || p.Recent != "FP" || p.LearnedDate == "" {
		t.Errorf("word 1 progress = %+v", p)
	}
	var hist []study.Day
	call(t, srv, "GET", "/api/history", "", &hist)
	if len(hist) != 1 || len(hist[0].Learned) != 2 || hist[0].Learned[0].Fails != 1 || hist[0].Learned[0].Passes != 1 {
		t.Errorf("history = %+v", hist)
	}
}

func TestReloadWithoutProblemsSendsEmptyList(t *testing.T) {
	svc, err := study.NewService(context.Background(), memstore.New(vocab.SampleWords()), time.UTC)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(NewHandler(svc, Options{Logger: slog.New(slog.NewTextHandler(io.Discard, nil))}))
	defer srv.Close()
	resp, err := http.Post(srv.URL+"/api/admin/reload", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(b), `"grammarProblems":[]`) {
		t.Errorf("reload body = %s, want an empty grammarProblems list", b)
	}
}

func TestGrammar(t *testing.T) {
	srv := newServer(t)
	var list []grammar.Summary
	if code := call(t, srv, "GET", "/api/grammar", "", &list); code != 200 || len(list) != 1 || list[0].Drills != 1 {
		t.Fatalf("list: %d %+v", code, list)
	}
	var lesson grammar.Lesson
	if code := call(t, srv, "GET", "/api/grammar/time", "", &lesson); code != 200 || lesson.Sections[0].Priority != "high" {
		t.Fatalf("lesson: %d %+v", code, lesson)
	}
	if code := call(t, srv, "GET", "/api/grammar/nope", "", nil); code != 404 {
		t.Errorf("unknown lesson: status %d, want 404", code)
	}
	var report struct {
		Words           int      `json:"words"`
		Lessons         int      `json:"lessons"`
		GrammarProblems []string `json:"grammarProblems"`
	}
	if code := call(t, srv, "POST", "/api/admin/reload", "", &report); code != 200 {
		t.Fatalf("reload: %d", code)
	}
	if report.Words != 10 || report.Lessons != 1 || len(report.GrammarProblems) != 1 {
		t.Errorf("reload report = %+v", report)
	}
}

func TestReading(t *testing.T) {
	srv := newServer(t)
	var o study.ReadingOverview
	if code := call(t, srv, "GET", "/api/reading", "", &o); code != 200 || len(o.Sets) != 1 || o.Sets[0].Questions != 1 {
		t.Fatalf("overview: %d %+v", code, o)
	}
	var set reading.Set
	if code := call(t, srv, "GET", "/api/reading/r1", "", &set); code != 200 || set.Passages[0].Kind != "notice" {
		t.Fatalf("set: %d %+v", code, set)
	}
	if code := call(t, srv, "GET", "/api/reading/nope", "", nil); code != 404 {
		t.Errorf("unknown set: status %d, want 404", code)
	}
}

func TestMockResults(t *testing.T) {
	srv := newServer(t)
	var sets []reading.Set
	if code := call(t, srv, "GET", "/api/reading/sets?part=7", "", &sets); code != 200 || len(sets) != 1 || len(sets[0].Questions) != 1 {
		t.Fatalf("part 7 sets: %d %+v", code, sets)
	}
	if code := call(t, srv, "GET", "/api/reading/sets?part=5", "", nil); code != 400 {
		t.Errorf("part 5: status %d, want 400", code)
	}

	good := `{"part":7,"correct":40,"total":54,"seconds":3000,"limit":3300,` +
		`"byType":{"detail":{"correct":25,"total":30},"cross":{"correct":15,"total":24}},` +
		`"byFormat":{"single":{"correct":22,"total":29},"multi":{"correct":18,"total":25}}}`
	var saved reading.MockResult
	if code := call(t, srv, "POST", "/api/mock-results", good, &saved); code != 201 || saved.Date == "" || saved.Correct != 40 {
		t.Fatalf("save: %d %+v", code, saved)
	}
	for name, body := range map[string]string{
		"correct > total": `{"part":7,"correct":60,"total":54,"seconds":10,"limit":3300,"byType":{},"byFormat":{}}`,
		"breakdown off":   `{"part":7,"correct":1,"total":2,"seconds":10,"limit":3300,"byType":{"detail":{"correct":1,"total":1}},"byFormat":{"single":{"correct":1,"total":2}}}`,
		"wrong part":      `{"part":3,"correct":1,"total":1,"seconds":10,"limit":3300,"byType":{"detail":{"correct":1,"total":1}},"byFormat":{"single":{"correct":1,"total":1}}}`,
	} {
		if code := call(t, srv, "POST", "/api/mock-results", body, nil); code != 400 {
			t.Errorf("%s: status %d, want 400", name, code)
		}
	}
	var results []reading.MockResult
	call(t, srv, "GET", "/api/mock-results?part=7", "", &results)
	if len(results) != 1 || results[0].ByFormat["multi"].Total != 25 {
		t.Errorf("results = %+v", results)
	}
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}
