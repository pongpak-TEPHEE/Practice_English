package reading

import (
	"encoding/json"
	"fmt"
)

// Score is correct answers out of a total.
type Score struct {
	Correct int `json:"correct"`
	Total   int `json:"total"`
}

// MockResult is one timed mock exam, kept so progress can be compared over time.
type MockResult struct {
	Date     string           `json:"date"` // set by the server, in the learner's time zone
	Time     string           `json:"time"`
	Part     int              `json:"part"`
	Correct  int              `json:"correct"`
	Total    int              `json:"total"`
	Seconds  int              `json:"seconds"`  // time used
	Limit    int              `json:"limit"`    // time allowed
	ByType   map[string]Score `json:"byType"`   // question type -> score
	ByFormat map[string]Score `json:"byFormat"` // single / double / triple -> score
}

// Validate rejects results that can't be right, so a bad request never reaches the sheet.
func (r MockResult) Validate() error {
	switch {
	case r.Part != 6 && r.Part != 7:
		return fmt.Errorf("part must be 6 or 7")
	case r.Total < 1 || r.Total > 200:
		return fmt.Errorf("total must be 1 to 200")
	case r.Correct < 0 || r.Correct > r.Total:
		return fmt.Errorf("correct must be 0 to total")
	case r.Limit < 1 || r.Limit > 4*60*60:
		return fmt.Errorf("limit must be 1 second to 4 hours")
	case r.Seconds < 0 || r.Seconds > r.Limit+60:
		return fmt.Errorf("seconds must be between 0 and the limit")
	}
	for name, breakdown := range map[string]map[string]Score{"byType": r.ByType, "byFormat": r.ByFormat} {
		sum := Score{}
		for _, s := range breakdown {
			if s.Correct < 0 || s.Correct > s.Total {
				return fmt.Errorf("%s has a score with correct outside 0..total", name)
			}
			sum.Correct += s.Correct
			sum.Total += s.Total
		}
		if sum != (Score{r.Correct, r.Total}) {
			return fmt.Errorf("%s must add up to %d of %d", name, r.Correct, r.Total)
		}
	}
	return nil
}

// MockHeader is the mock_results tab's header row.
var MockHeader = []string{"date", "time", "part", "correct", "total", "seconds", "time_limit", "by_type", "by_format"}

// MockRow turns a result into a sheet row; breakdowns are stored as JSON.
func MockRow(r MockResult) []any {
	byType, _ := json.Marshal(r.ByType)
	byFormat, _ := json.Marshal(r.ByFormat)
	return []any{r.Date, r.Time, r.Part, r.Correct, r.Total, r.Seconds, r.Limit, string(byType), string(byFormat)}
}

// ParseMockRow reads a row written by MockRow.
func ParseMockRow(row []string) (MockResult, error) {
	get := func(i int) string {
		if i < len(row) {
			return row[i]
		}
		return ""
	}
	r := MockResult{Date: get(0), Time: get(1)}
	for i, dst := range []*int{&r.Part, &r.Correct, &r.Total, &r.Seconds, &r.Limit} {
		if _, err := fmt.Sscan(get(2+i), dst); err != nil {
			return r, fmt.Errorf("column %s: %q is not a number", MockHeader[2+i], get(2+i))
		}
	}
	if err := json.Unmarshal([]byte(get(7)), &r.ByType); err != nil {
		return r, fmt.Errorf("column by_type: %w", err)
	}
	if err := json.Unmarshal([]byte(get(8)), &r.ByFormat); err != nil {
		return r, fmt.Errorf("column by_format: %w", err)
	}
	return r, nil
}
