package vocab

// LogEntry is one answer, kept so history can show what was studied on each day.
type LogEntry struct {
	Date   string `json:"date"` // YYYY-MM-DD in the learner's time zone
	Time   string `json:"time"` // HH:MM:SS
	WordID int    `json:"wordId"`
	Mode   Mode   `json:"mode"`
	Result Result `json:"result"`
}
