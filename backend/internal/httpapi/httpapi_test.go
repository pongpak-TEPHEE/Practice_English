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

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/memstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/study"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

const token = "secret"

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	svc, err := study.NewService(context.Background(), memstore.New(vocab.SampleWords()), time.UTC)
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

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}
