// Package httpapi exposes the study service as a JSON API.
package httpapi

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/study"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

type Options struct {
	// APIToken, when set, must be sent as "Authorization: Bearer <token>" on /api/ routes.
	APIToken       string
	AllowedOrigins []string // "*" allows any origin
	Logger         *slog.Logger
}

type handler struct {
	svc  *study.Service
	opts Options
}

func NewHandler(svc *study.Service, opts Options) http.Handler {
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	h := &handler{svc: svc, opts: opts}

	api := http.NewServeMux()
	api.HandleFunc("GET /api/today", h.today)
	api.HandleFunc("GET /api/words", h.listWords)
	api.HandleFunc("GET /api/words/{id}", h.getWord)
	api.HandleFunc("PUT /api/words/{id}/favorite", h.setFavorite)
	api.HandleFunc("POST /api/answer", h.answer)
	api.HandleFunc("POST /api/answers", h.answers)
	api.HandleFunc("GET /api/stats", h.stats)
	api.HandleFunc("GET /api/history", h.history)
	api.HandleFunc("GET /api/achievements", h.achievements)
	api.HandleFunc("GET /api/grammar", h.grammarList)
	api.HandleFunc("GET /api/grammar/{id}", h.grammarLesson)
	api.HandleFunc("GET /api/reading", h.readingOverview)
	api.HandleFunc("GET /api/reading/sets", h.readingSets)
	api.HandleFunc("GET /api/reading/{id}", h.readingSet)
	api.HandleFunc("GET /api/mock-results", h.mockResults)
	api.HandleFunc("POST /api/mock-results", h.addMockResult)
	api.HandleFunc("GET /api/settings", h.getSettings)
	api.HandleFunc("PUT /api/settings", h.putSettings)
	api.HandleFunc("POST /api/admin/reload", h.reload)

	root := http.NewServeMux()
	root.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	root.Handle("/api/", h.requireToken(api))

	return h.logRequests(h.cors(root))
}

func (h *handler) today(w http.ResponseWriter, r *http.Request) {
	extra := 0
	if s := r.URL.Query().Get("extra"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 0 || n > 100 {
			writeError(w, http.StatusBadRequest, "extra must be a number from 0 to 100")
			return
		}
		extra = n
	}
	writeJSON(w, http.StatusOK, h.svc.Today(extra))
}

func (h *handler) listWords(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	words, err := h.svc.Words(study.WordFilter{
		Level:  q.Get("level"),
		Status: q.Get("status"),
		Deck:   q.Get("deck"),
		Query:  q.Get("q"),
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, words)
}

func (h *handler) getWord(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	v, err := h.svc.Word(id)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (h *handler) setFavorite(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var req struct {
		Favorite bool `json:"favorite"`
	}
	if !decode(w, r, &req) {
		return
	}
	v, err := h.svc.SetFavorite(r.Context(), id, req.Favorite)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (h *handler) answer(w http.ResponseWriter, r *http.Request) {
	var req struct {
		WordID int    `json:"wordId"`
		Result string `json:"result"` // pass | fail
		Mode   string `json:"mode"`   // learn | review (default)
	}
	if !decode(w, r, &req) {
		return
	}
	res, err := vocab.ParseResult(req.Result)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	mode, err := vocab.ParseMode(req.Mode)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	v, err := h.svc.Answer(r.Context(), req.WordID, res, mode)
	if errors.Is(err, study.ErrLogNotSaved) {
		h.opts.Logger.Warn("answer log", "err", err)
		err = nil
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, v)
}

// maxBatch bounds one session's answers; learn mode repeats failed words, so allow plenty.
const maxBatch = 500

func (h *handler) answers(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Mode    string `json:"mode"` // learn | review (default)
		Answers []struct {
			WordID int    `json:"wordId"`
			Result string `json:"result"`
		} `json:"answers"`
	}
	if !decode(w, r, &req) {
		return
	}
	mode, err := vocab.ParseMode(req.Mode)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Answers) == 0 || len(req.Answers) > maxBatch {
		writeError(w, http.StatusBadRequest, "answers must have 1 to 500 items")
		return
	}
	items := make([]study.AnswerItem, len(req.Answers))
	for i, a := range req.Answers {
		res, err := vocab.ParseResult(a.Result)
		if err != nil {
			writeError(w, http.StatusBadRequest, "answers["+strconv.Itoa(i)+"]: "+err.Error())
			return
		}
		items[i] = study.AnswerItem{WordID: a.WordID, Result: res}
	}
	views, err := h.svc.AnswerBatch(r.Context(), mode, items)
	if errors.Is(err, study.ErrLogNotSaved) {
		h.opts.Logger.Warn("answer log", "err", err)
		err = nil
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, views)
}

func (h *handler) stats(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.Stats())
}

func (h *handler) history(w http.ResponseWriter, r *http.Request) {
	days := 30
	if s := r.URL.Query().Get("days"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 365 {
			writeError(w, http.StatusBadRequest, "days must be a number from 1 to 365")
			return
		}
		days = n
	}
	level := strings.ToUpper(r.URL.Query().Get("level"))
	if level != "" && !slices.Contains(vocab.Levels, level) {
		writeError(w, http.StatusBadRequest, "level must be A1, A2, B1 or B2")
		return
	}
	writeJSON(w, http.StatusOK, h.svc.History(days, level))
}

func (h *handler) achievements(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.Achievements())
}

func (h *handler) getSettings(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.Settings())
}

func (h *handler) putSettings(w http.ResponseWriter, r *http.Request) {
	next := h.svc.Settings() // fields left out of the body keep their current value
	if !decode(w, r, &next) {
		return
	}
	saved, err := h.svc.UpdateSettings(r.Context(), next)
	if err != nil {
		var status = http.StatusBadRequest
		if next.Validate() == nil {
			status = http.StatusBadGateway
			h.opts.Logger.Error("save settings", "err", err)
		}
		writeError(w, status, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (h *handler) grammarList(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.GrammarLessons())
}

func (h *handler) grammarLesson(w http.ResponseWriter, r *http.Request) {
	l, err := h.svc.GrammarLesson(r.PathValue("id"))
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (h *handler) readingOverview(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, h.svc.Reading())
}

func (h *handler) readingSet(w http.ResponseWriter, r *http.Request) {
	set, err := h.svc.ReadingSet(r.PathValue("id"))
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, set)
}

func partParam(w http.ResponseWriter, r *http.Request) (int, bool) {
	part, err := strconv.Atoi(r.URL.Query().Get("part"))
	if err != nil || (part != 6 && part != 7) {
		writeError(w, http.StatusBadRequest, "part must be 6 or 7")
		return 0, false
	}
	return part, true
}

// readingSets returns every set of a part with its content, for a mock exam.
func (h *handler) readingSets(w http.ResponseWriter, r *http.Request) {
	if part, ok := partParam(w, r); ok {
		writeJSON(w, http.StatusOK, h.svc.ReadingPart(part))
	}
}

func (h *handler) mockResults(w http.ResponseWriter, r *http.Request) {
	if part, ok := partParam(w, r); ok {
		writeJSON(w, http.StatusOK, h.svc.MockResults(part))
	}
}

func (h *handler) addMockResult(w http.ResponseWriter, r *http.Request) {
	var res reading.MockResult
	if !decode(w, r, &res) {
		return
	}
	saved, err := h.svc.AddMockResult(r.Context(), res)
	if errors.Is(err, study.ErrInvalid) {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

// reload re-reads the sheet after it was edited by hand and says what was loaded.
func (h *handler) reload(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.Reload(r.Context()); err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"words":           h.svc.Stats().Total,
		"lessons":         len(h.svc.GrammarLessons()),
		"grammarProblems": h.svc.GrammarProblems(),
		"readingSets":     len(h.svc.Reading().Sets),
		"readingProblems": h.svc.ReadingProblems(),
	})
}

func (h *handler) fail(w http.ResponseWriter, err error) {
	if errors.Is(err, study.ErrWordNotFound) || errors.Is(err, study.ErrLessonNotFound) || errors.Is(err, study.ErrSetNotFound) {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	h.opts.Logger.Error("request failed", "err", err)
	writeError(w, http.StatusBadGateway, "storage error, please try again")
}

func pathID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "id must be a number")
		return 0, false
	}
	return id, true
}

func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

func (h *handler) requireToken(next http.Handler) http.Handler {
	if h.opts.APIToken == "" {
		return next
	}
	want := []byte("Bearer " + h.opts.APIToken)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), want) != 1 {
			writeError(w, http.StatusUnauthorized, "missing or wrong API token")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *handler) cors(next http.Handler) http.Handler {
	anyOrigin := slices.Contains(h.opts.AllowedOrigins, "*")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (anyOrigin || slices.Contains(h.opts.AllowedOrigins, origin)) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "86400")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (h *handler) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if r.URL.Path == "/healthz" {
			return
		}
		h.opts.Logger.Info("request", "method", r.Method, "path", r.URL.Path,
			"status", rec.status, "duration", time.Since(start).Round(time.Millisecond))
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
