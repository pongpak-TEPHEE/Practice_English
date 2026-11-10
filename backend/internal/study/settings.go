package study

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

// Settings are the learner's preferences, stored as key/value rows.
type Settings struct {
	NewPerDay    int         `json:"newPerDay"`    // new words to learn each day
	RoundsPerDay int         `json:"roundsPerDay"` // review rounds for today's words
	Level        string      `json:"level"`        // level new words come from
	Accent       string      `json:"accent"`       // "us" or "uk"
	Tiers        vocab.Tiers `json:"tiers"`        // pass days for each mastery tier
}

var DefaultSettings = Settings{
	NewPerDay:    10,
	RoundsPerDay: 3,
	Level:        "A1",
	Accent:       "us",
	Tiers:        vocab.DefaultTiers,
}

func (s Settings) Validate() error {
	switch {
	case s.NewPerDay < 1 || s.NewPerDay > 100:
		return fmt.Errorf("newPerDay must be 1–100")
	case s.RoundsPerDay < 0 || s.RoundsPerDay > 20:
		return fmt.Errorf("roundsPerDay must be 0–20")
	case !slices.Contains(vocab.Levels, s.Level):
		return fmt.Errorf("level must be one of %s", strings.Join(vocab.Levels, ", "))
	case s.Accent != "us" && s.Accent != "uk":
		return fmt.Errorf("accent must be us or uk")
	case s.Tiers.Familiar < 1 || s.Tiers.Known <= s.Tiers.Familiar || s.Tiers.Mastered <= s.Tiers.Known || s.Tiers.Mastered > 100:
		return fmt.Errorf("tiers must increase: 1 ≤ familiar < known < mastered ≤ 100")
	}
	return nil
}

func (s Settings) toMap() map[string]string {
	return map[string]string{
		"new_per_day":    strconv.Itoa(s.NewPerDay),
		"rounds_per_day": strconv.Itoa(s.RoundsPerDay),
		"level":          s.Level,
		"accent":         s.Accent,
		"tier_familiar":  strconv.Itoa(s.Tiers.Familiar),
		"tier_known":     strconv.Itoa(s.Tiers.Known),
		"tier_mastered":  strconv.Itoa(s.Tiers.Mastered),
	}
}

// settingsFromMap overlays stored values on the defaults, ignoring anything invalid.
func settingsFromMap(m map[string]string) Settings {
	s := DefaultSettings
	num := func(key string, dst *int) {
		if n, err := strconv.Atoi(strings.TrimSpace(m[key])); err == nil {
			*dst = n
		}
	}
	num("new_per_day", &s.NewPerDay)
	num("rounds_per_day", &s.RoundsPerDay)
	num("tier_familiar", &s.Tiers.Familiar)
	num("tier_known", &s.Tiers.Known)
	num("tier_mastered", &s.Tiers.Mastered)
	if v := strings.ToUpper(strings.TrimSpace(m["level"])); v != "" {
		s.Level = v
	}
	if v := strings.ToLower(strings.TrimSpace(m["accent"])); v != "" {
		s.Accent = v
	}
	if s.Validate() != nil {
		return DefaultSettings
	}
	return s
}
