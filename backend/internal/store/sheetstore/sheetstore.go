// Package sheetstore keeps words, progress and settings in a Google Spreadsheet.
//
// Layout (row 1 is a header in every tab):
//
//	words:    id | word | pos | level | meaning_th | example | audio_uk | audio_us
//	progress: word_id | ease | interval | repetitions | due_date | last_reviewed | review_count | lapses |
//	          favorite | pass_count | fail_count | pass_days | last_pass_date | recent | missed |
//	          learned_date | round_date | rounds_today
//	settings: key | value
//	log:      date | time | word_id | mode | result   (one row per answer)
//	grammar_*: grammar lessons, see package grammar for the five tabs' columns
//	reading_*: Reading Part 6 and 7 sets, see package reading
//	Videos, Transcripts: listening videos edited by hand, video_results: practice scores; see package video
package sheetstore

import (
	"context"
	"errors"
	"fmt"
	"maps"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/video"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

const (
	wordsTab    = "words"
	progressTab = "progress"
	settingsTab = "settings"
	logTab      = "log"
	mockTab     = "mock_results"

	wordsCols    = "A2:H"
	progressCols = "R" // last column of the progress tab
)

var (
	wordsHeader    = []any{"id", "word", "pos", "level", "meaning_th", "example", "audio_uk", "audio_us"}
	progressHeader = []any{"word_id", "ease", "interval", "repetitions", "due_date", "last_reviewed", "review_count", "lapses",
		"favorite", "pass_count", "fail_count", "pass_days", "last_pass_date", "recent", "missed",
		"learned_date", "round_date", "rounds_today"}
	settingsHeader = []any{"key", "value"}
	logHeader      = []any{"date", "time", "word_id", "mode", "result"}
)

type Store struct {
	api           *sheets.Service
	spreadsheetID string

	mu           sync.Mutex
	progressRows map[int]int // word id -> 1-based sheet row
}

// New connects with a service-account key (the JSON file downloaded from Google Cloud).
// The spreadsheet must be shared with the service account's email as Editor.
func New(ctx context.Context, credentialsJSON []byte, spreadsheetID string) (*Store, error) {
	conf, err := google.JWTConfigFromJSON(credentialsJSON, sheets.SpreadsheetsScope)
	if err != nil {
		return nil, fmt.Errorf("parse service account credentials: %w", err)
	}
	// The client refreshes tokens with this context, so it must outlive the request.
	api, err := sheets.NewService(ctx, option.WithHTTPClient(conf.Client(context.Background())))
	if err != nil {
		return nil, fmt.Errorf("create sheets client: %w", err)
	}
	return &Store{api: api, spreadsheetID: spreadsheetID, progressRows: map[int]int{}}, nil
}

func (s *Store) LoadWords(ctx context.Context) ([]vocab.Word, error) {
	rows, err := s.readRows(ctx, wordsTab+"!"+wordsCols)
	if err != nil {
		return nil, err
	}
	words := make([]vocab.Word, 0, len(rows))
	for i, row := range rows {
		if cell(row, 1) == "" {
			continue
		}
		id, err := strconv.Atoi(cell(row, 0))
		if err != nil {
			return nil, fmt.Errorf("%s row %d: invalid id %q", wordsTab, i+2, cell(row, 0))
		}
		words = append(words, vocab.Word{
			ID:        id,
			Word:      cell(row, 1),
			POS:       cell(row, 2),
			Level:     strings.ToUpper(cell(row, 3)),
			MeaningTH: cell(row, 4),
			Example:   cell(row, 5),
			AudioUK:   cell(row, 6),
			AudioUS:   cell(row, 7),
		})
	}
	return words, nil
}

func (s *Store) LoadProgress(ctx context.Context) ([]vocab.Progress, error) {
	rows, err := s.readRows(ctx, progressTab+"!A2:"+progressCols)
	if err != nil {
		return nil, err
	}
	out := make([]vocab.Progress, 0, len(rows))
	rowOf := make(map[int]int, len(rows))
	for i, row := range rows {
		if cell(row, 0) == "" {
			continue
		}
		p, err := parseProgress(row)
		if err != nil {
			return nil, fmt.Errorf("%s row %d: %w", progressTab, i+2, err)
		}
		out = append(out, p)
		rowOf[p.WordID] = i + 2
	}
	s.mu.Lock()
	s.progressRows = rowOf
	s.mu.Unlock()
	return out, nil
}

// SaveProgress overwrites each word's existing row and appends rows for new words,
// using at most two API calls however many words there are.
// New rows go first and their row numbers are remembered as soon as they exist, so
// retrying after a failed update overwrites them instead of appending duplicates.
func (s *Store) SaveProgress(ctx context.Context, ps ...vocab.Progress) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	latest := map[int]int{} // word id -> index of its last value in ps
	for i, p := range ps {
		latest[p.WordID] = i
	}
	var updates []*sheets.ValueRange
	var fresh []vocab.Progress
	for i, p := range ps {
		if latest[p.WordID] != i {
			continue
		}
		if row, ok := s.progressRows[p.WordID]; ok {
			updates = append(updates, &sheets.ValueRange{
				Range:  fmt.Sprintf("%s!A%d:%s%d", progressTab, row, progressCols, row),
				Values: [][]any{progressRow(p)},
			})
		} else {
			fresh = append(fresh, p)
		}
	}

	if len(fresh) > 0 {
		rows := make([][]any, len(fresh))
		for i, p := range fresh {
			rows[i] = progressRow(p)
		}
		resp, err := s.api.Spreadsheets.Values.Append(s.spreadsheetID, progressTab+"!A:"+progressCols, &sheets.ValueRange{Values: rows}).
			ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
		if err != nil {
			return err
		}
		first, err := firstRow(resp.Updates.UpdatedRange)
		if err != nil {
			return err
		}
		for i, p := range fresh {
			s.progressRows[p.WordID] = first + i
		}
	}

	if len(updates) > 0 {
		_, err := s.api.Spreadsheets.Values.BatchUpdate(s.spreadsheetID, &sheets.BatchUpdateValuesRequest{
			ValueInputOption: "RAW",
			Data:             updates,
		}).Context(ctx).Do()
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) LoadSettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.readRows(ctx, settingsTab+"!A2:B")
	if err != nil {
		return nil, err
	}
	kv := map[string]string{}
	for _, row := range rows {
		if k := cell(row, 0); k != "" {
			kv[k] = cell(row, 1)
		}
	}
	return kv, nil
}

// SaveSettings replaces the settings tab with kv, sorted by key.
func (s *Store) SaveSettings(ctx context.Context, kv map[string]string) error {
	rows := [][]any{}
	for _, k := range slices.Sorted(maps.Keys(kv)) {
		rows = append(rows, []any{k, kv[k]})
	}
	_, err := s.api.Spreadsheets.Values.BatchClear(s.spreadsheetID, &sheets.BatchClearValuesRequest{
		Ranges: []string{settingsTab + "!A2:B"},
	}).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("clear settings: %w", err)
	}
	_, err = s.api.Spreadsheets.Values.Update(s.spreadsheetID, settingsTab+"!A2:B", &sheets.ValueRange{Values: rows}).
		ValueInputOption("RAW").Context(ctx).Do()
	return err
}

func (s *Store) LoadLog(ctx context.Context) ([]vocab.LogEntry, error) {
	rows, err := s.readRows(ctx, logTab+"!A2:E")
	if err != nil {
		return nil, err
	}
	out := make([]vocab.LogEntry, 0, len(rows))
	for i, row := range rows {
		if cell(row, 0) == "" {
			continue
		}
		id, err := strconv.Atoi(cell(row, 2))
		if err != nil {
			return nil, fmt.Errorf("%s row %d: invalid word_id %q", logTab, i+2, cell(row, 2))
		}
		out = append(out, vocab.LogEntry{
			Date: cell(row, 0), Time: cell(row, 1), WordID: id,
			Mode: vocab.Mode(cell(row, 3)), Result: vocab.Result(cell(row, 4)),
		})
	}
	return out, nil
}

func (s *Store) AppendLog(ctx context.Context, es ...vocab.LogEntry) error {
	if len(es) == 0 {
		return nil
	}
	rows := make([][]any, len(es))
	for i, e := range es {
		rows[i] = []any{e.Date, e.Time, e.WordID, string(e.Mode), string(e.Result)}
	}
	_, err := s.api.Spreadsheets.Values.Append(s.spreadsheetID, logTab+"!A:E", &sheets.ValueRange{Values: rows}).
		ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
	return err
}

// LoadMockResults reads every mock exam result; rows that can't be read are skipped.
func (s *Store) LoadMockResults(ctx context.Context) ([]reading.MockResult, error) {
	rows, err := s.readRows(ctx, mockTab+"!A2:I")
	if err != nil {
		return nil, err
	}
	out := []reading.MockResult{}
	for _, row := range rows {
		cells := make([]string, len(row))
		for i := range row {
			cells[i] = cell(row, i)
		}
		if r, err := reading.ParseMockRow(cells); err == nil {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *Store) AppendMockResult(ctx context.Context, r reading.MockResult) error {
	_, err := s.api.Spreadsheets.Values.Append(s.spreadsheetID, mockTab+"!A:I", &sheets.ValueRange{Values: [][]any{reading.MockRow(r)}}).
		ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
	return err
}

// LoadVideos reads the two video tabs whole, header row included, because the
// columns are found by name. Numbers are read unformatted so a cell shown with
// fewer decimals still gives the exact time.
func (s *Store) LoadVideos(ctx context.Context) (video.Tables, error) {
	ranges := []string{video.TabVideos + "!A1:Z", video.TabTranscripts + "!A1:Z"}
	resp, err := s.api.Spreadsheets.Values.BatchGet(s.spreadsheetID).Ranges(ranges...).
		ValueRenderOption("UNFORMATTED_VALUE").Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", strings.Join(ranges, ", "), err)
	}
	out := video.Tables{}
	for i, vr := range resp.ValueRanges {
		rows := make([][]string, len(vr.Values))
		for r, row := range vr.Values {
			rows[r] = make([]string, len(row))
			for c := range row {
				rows[r][c] = cell(row, c)
			}
		}
		out[[]string{video.TabVideos, video.TabTranscripts}[i]] = rows
	}
	return out, nil
}

// LoadVideoResults reads every video practice result; rows that can't be read are skipped.
func (s *Store) LoadVideoResults(ctx context.Context) ([]video.Result, error) {
	rows, err := s.readRows(ctx, video.TabResults+"!A2:K")
	if err != nil {
		return nil, err
	}
	out := []video.Result{}
	for _, row := range rows {
		cells := make([]string, len(row))
		for i := range row {
			cells[i] = cell(row, i)
		}
		if r, err := video.ParseResultRow(cells); err == nil {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *Store) AppendVideoResult(ctx context.Context, r video.Result) error {
	_, err := s.api.Spreadsheets.Values.Append(s.spreadsheetID, video.TabResults+"!A:K", &sheets.ValueRange{Values: [][]any{video.ResultRow(r)}}).
		ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
	return err
}

func toAny(ss []string) []any {
	out := make([]any, len(ss))
	for i, v := range ss {
		out[i] = v
	}
	return out
}

// Setup creates the tabs and their header rows if missing.
func (s *Store) Setup(ctx context.Context) error {
	ss, err := s.api.Spreadsheets.Get(s.spreadsheetID).Fields("sheets.properties.title").Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("open spreadsheet: %w", err)
	}
	have := map[string]bool{}
	for _, sh := range ss.Sheets {
		have[sh.Properties.Title] = true
	}
	var add []*sheets.Request
	tabs := []string{wordsTab, progressTab, settingsTab, logTab, mockTab, video.TabResults}
	for _, t := range contentTabs() {
		tabs = append(tabs, t.name)
	}
	// The video tabs are edited by hand: create them with a header only when missing,
	// and never rewrite a header the learner may have changed.
	var videoHeaders []*sheets.ValueRange
	for _, t := range []struct {
		name   string
		header []string
	}{{video.TabVideos, video.VideosHeader}, {video.TabTranscripts, video.TranscriptsHeader}} {
		if !have[t.name] {
			tabs = append(tabs, t.name)
			videoHeaders = append(videoHeaders, &sheets.ValueRange{
				Range: fmt.Sprintf("%s!A1:%s1", t.name, column(len(t.header))), Values: [][]any{toAny(t.header)}})
		}
	}
	for _, tab := range tabs {
		if !have[tab] {
			add = append(add, &sheets.Request{AddSheet: &sheets.AddSheetRequest{
				Properties: &sheets.SheetProperties{Title: tab},
			}})
		}
	}
	if len(add) > 0 {
		_, err := s.api.Spreadsheets.BatchUpdate(s.spreadsheetID, &sheets.BatchUpdateSpreadsheetRequest{Requests: add}).
			Context(ctx).Do()
		if err != nil {
			return fmt.Errorf("create tabs: %w", err)
		}
	}
	_, err = s.api.Spreadsheets.Values.BatchUpdate(s.spreadsheetID, &sheets.BatchUpdateValuesRequest{
		ValueInputOption: "RAW",
		Data: append([]*sheets.ValueRange{
			{Range: wordsTab + "!A1:H1", Values: [][]any{wordsHeader}},
			{Range: progressTab + "!A1:" + progressCols + "1", Values: [][]any{progressHeader}},
			{Range: settingsTab + "!A1:B1", Values: [][]any{settingsHeader}},
			{Range: logTab + "!A1:E1", Values: [][]any{logHeader}},
			{Range: mockTab + "!A1:I1", Values: [][]any{toAny(reading.MockHeader)}},
			{Range: video.TabResults + "!A1:K1", Values: [][]any{toAny(video.ResultHeader)}},
		}, append(contentHeaders(), videoHeaders...)...),
	}).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("write headers: %w", err)
	}
	return nil
}

// tabSpec is a content tab (grammar or reading) and its header row.
type tabSpec struct {
	name   string
	header []string
}

func grammarTabs() []tabSpec {
	out := make([]tabSpec, len(grammar.Tabs))
	for i, g := range grammar.Tabs {
		out[i] = tabSpec{g.Name, g.Header}
	}
	return out
}

func readingTabs() []tabSpec {
	out := make([]tabSpec, len(reading.Tabs))
	for i, r := range reading.Tabs {
		out[i] = tabSpec{r.Name, r.Header}
	}
	return out
}

func contentTabs() []tabSpec { return append(grammarTabs(), readingTabs()...) }

func contentHeaders() []*sheets.ValueRange {
	var out []*sheets.ValueRange
	for _, t := range contentTabs() {
		row := make([]any, len(t.header))
		for i, h := range t.header {
			row[i] = h
		}
		out = append(out, &sheets.ValueRange{Range: fmt.Sprintf("%s!A1:%s1", t.name, column(len(t.header))), Values: [][]any{row}})
	}
	return out
}

// dataRange is a tab's data rows (below the header) across all its columns.
func dataRange(t tabSpec) string {
	return fmt.Sprintf("%s!A2:%s", t.name, column(len(t.header)))
}

// column returns the letter of the n-th column (1 = A); content tabs stay within A–Z.
func column(n int) string { return string(rune('A' + n - 1)) }

// loadTabs reads the data rows of several tabs in one request.
func (s *Store) loadTabs(ctx context.Context, tabs []tabSpec) (map[string][][]string, error) {
	ranges := make([]string, len(tabs))
	for i, t := range tabs {
		ranges[i] = dataRange(t)
	}
	resp, err := s.api.Spreadsheets.Values.BatchGet(s.spreadsheetID).Ranges(ranges...).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", strings.Join(ranges, ", "), err)
	}
	out := map[string][][]string{}
	for i, vr := range resp.ValueRanges {
		rows := make([][]string, len(vr.Values))
		for r, row := range vr.Values {
			rows[r] = make([]string, len(row))
			for c := range row {
				rows[r][c] = cell(row, c)
			}
		}
		out[tabs[i].name] = rows
	}
	return out, nil
}

// replaceTabs clears the data rows of tabs and writes rows in their place.
func (s *Store) replaceTabs(ctx context.Context, tabs []tabSpec, rows map[string][][]string) error {
	ranges := make([]string, len(tabs))
	for i, t := range tabs {
		ranges[i] = dataRange(t)
	}
	_, err := s.api.Spreadsheets.Values.BatchClear(s.spreadsheetID, &sheets.BatchClearValuesRequest{Ranges: ranges}).
		Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("clear tabs: %w", err)
	}
	for i, t := range tabs {
		if len(rows[t.name]) == 0 {
			continue
		}
		values := make([][]any, len(rows[t.name]))
		for r, row := range rows[t.name] {
			values[r] = make([]any, len(row))
			for c, v := range row {
				values[r][c] = v
			}
		}
		// Append (not Update) so a tab grows past the sheet's default row count.
		_, err := s.api.Spreadsheets.Values.Append(s.spreadsheetID, ranges[i], &sheets.ValueRange{Values: values}).
			ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
		if err != nil {
			return fmt.Errorf("write %s: %w", t.name, err)
		}
	}
	return nil
}

func (s *Store) LoadGrammar(ctx context.Context) (grammar.Tables, error) {
	return s.loadTabs(ctx, grammarTabs())
}

func (s *Store) ReplaceGrammar(ctx context.Context, t grammar.Tables) error {
	return s.replaceTabs(ctx, grammarTabs(), t)
}

func (s *Store) LoadReading(ctx context.Context) (reading.Tables, error) {
	return s.loadTabs(ctx, readingTabs())
}

func (s *Store) ReplaceReading(ctx context.Context, t reading.Tables) error {
	return s.replaceTabs(ctx, readingTabs(), t)
}

// ReplaceWords clears the words tab and writes the given list.
func (s *Store) ReplaceWords(ctx context.Context, words []vocab.Word) error {
	_, err := s.api.Spreadsheets.Values.Clear(s.spreadsheetID, wordsTab+"!"+wordsCols, &sheets.ClearValuesRequest{}).
		Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("clear words: %w", err)
	}
	rows := make([][]any, len(words))
	for i, w := range words {
		rows[i] = []any{w.ID, w.Word, w.POS, w.Level, w.MeaningTH, w.Example, w.AudioUK, w.AudioUS}
	}
	// Append (not Update) so the sheet grows past its default 1000 rows.
	_, err = s.api.Spreadsheets.Values.Append(s.spreadsheetID, wordsTab+"!A1:H", &sheets.ValueRange{Values: rows}).
		ValueInputOption("RAW").InsertDataOption("INSERT_ROWS").Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("write words: %w", err)
	}
	return nil
}

// ClearProgress deletes every progress row, keeping the header.
func (s *Store) ClearProgress(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.api.Spreadsheets.Values.Clear(s.spreadsheetID, progressTab+"!A2:"+progressCols, &sheets.ClearValuesRequest{}).
		Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("clear progress: %w", err)
	}
	s.progressRows = map[int]int{}
	return nil
}

func (s *Store) readRows(ctx context.Context, rng string) ([][]any, error) {
	resp, err := s.api.Spreadsheets.Values.Get(s.spreadsheetID, rng).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", rng, err)
	}
	return resp.Values, nil
}

func cell(row []any, i int) string {
	if i >= len(row) {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(row[i]))
}

func parseProgress(row []any) (vocab.Progress, error) {
	var errs []error
	atoi := func(i int) int {
		s := cell(row, i)
		if s == "" {
			return 0
		}
		n, err := strconv.Atoi(s)
		if err != nil {
			errs = append(errs, fmt.Errorf("column %s: %q is not a number", progressHeader[i], s))
		}
		return n
	}
	boolean := func(i int) bool { return strings.EqualFold(cell(row, i), "true") }

	p := vocab.Progress{
		WordID:       atoi(0),
		Interval:     atoi(2),
		Repetitions:  atoi(3),
		DueDate:      cell(row, 4),
		LastReviewed: cell(row, 5),
		ReviewCount:  atoi(6),
		Lapses:       atoi(7),
		Favorite:     boolean(8),
		PassCount:    atoi(9),
		FailCount:    atoi(10),
		PassDays:     atoi(11),
		LastPassDate: cell(row, 12),
		Recent:       cell(row, 13),
		Missed:       boolean(14),
		LearnedDate:  cell(row, 15),
		RoundDate:    cell(row, 16),
		RoundsToday:  atoi(17),
	}
	if s := cell(row, 1); s != "" {
		ease, err := strconv.ParseFloat(s, 64)
		if err != nil {
			errs = append(errs, fmt.Errorf("column ease: %q is not a number", s))
		}
		p.Ease = ease
	}
	return p, errors.Join(errs...)
}

func progressRow(p vocab.Progress) []any {
	return []any{p.WordID, p.Ease, p.Interval, p.Repetitions, p.DueDate, p.LastReviewed, p.ReviewCount, p.Lapses,
		p.Favorite, p.PassCount, p.FailCount, p.PassDays, p.LastPassDate, p.Recent, p.Missed,
		p.LearnedDate, p.RoundDate, p.RoundsToday}
}

var rangeRow = regexp.MustCompile(`![A-Z]+(\d+)`)

// firstRow extracts the first row number from an A1 range like "progress!A5:R5".
func firstRow(a1 string) (int, error) {
	m := rangeRow.FindStringSubmatch(a1)
	if m == nil {
		return 0, fmt.Errorf("unexpected range %q from append", a1)
	}
	return strconv.Atoi(m[1])
}
