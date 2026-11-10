// Command seed prepares the Google Sheet: it creates every tab with its header,
// loads word lists from CSV into the words tab and grammar lessons from JSON
// into the grammar tabs.
//
//	GOOGLE_SHEET_ID=... GOOGLE_CREDENTIALS_FILE=key.json go run ./cmd/seed \
//	    -csv data/oxford3000.csv,data/toeic_service_list.csv -grammar data/grammar
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/config"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/grammar"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/reading"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/sheetstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

func main() {
	csvPath := flag.String("csv", "", "comma-separated word list CSVs (header: id,word,pos,level,meaning_th,example)")
	force := flag.Bool("force", false, "replace the words tab even if it already has words")
	resetProgress := flag.Bool("reset-progress", false, "delete all learning progress (start over)")
	grammarDir := flag.String("grammar", "", "folder of grammar lesson JSON files to load into the grammar tabs")
	readingDir := flag.String("reading", "", "folder of reading set JSON files to load into the reading tabs")
	flag.Parse()
	if err := run(*csvPath, *grammarDir, *readingDir, *force, *resetProgress); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func run(csvPath, grammarDir, readingDir string, force, resetProgress bool) error {
	sheetID := os.Getenv("GOOGLE_SHEET_ID")
	if sheetID == "" {
		return errors.New("GOOGLE_SHEET_ID is required")
	}
	creds, err := config.LoadCredentials()
	if err != nil {
		return err
	}
	ctx := context.Background()
	store, err := sheetstore.New(ctx, creds, sheetID)
	if err != nil {
		return err
	}
	if err := store.Setup(ctx); err != nil {
		return err
	}
	fmt.Println("tabs and headers ready")
	if resetProgress {
		if err := store.ClearProgress(ctx); err != nil {
			return err
		}
		fmt.Println("progress cleared")
	}
	if grammarDir != "" {
		if err := seedGrammar(ctx, store, grammarDir, force); err != nil {
			return err
		}
	}
	if readingDir != "" {
		if err := seedReading(ctx, store, readingDir, force); err != nil {
			return err
		}
	}
	if csvPath == "" {
		return nil
	}

	words, err := vocab.ReadCSVFiles(vocab.SplitPaths(csvPath)...)
	if err != nil {
		return err
	}

	existing, err := store.LoadWords(ctx)
	if err != nil {
		return err
	}
	if len(existing) > 0 && !force {
		return fmt.Errorf("words tab already has %d words; pass -force to replace them (progress is keyed by id, so keep ids stable)", len(existing))
	}
	if err := store.ReplaceWords(ctx, words); err != nil {
		return err
	}
	fmt.Printf("wrote %d words\n", len(words))
	return nil
}

func seedGrammar(ctx context.Context, store *sheetstore.Store, dir string, force bool) error {
	lessons, err := grammar.ReadDir(dir)
	if err != nil {
		return err
	}
	tables := grammar.Flatten(lessons)
	// The source files must be clean; the sheet is allowed typos, these are not.
	if _, problems := grammar.Assemble(tables); len(problems) > 0 {
		return fmt.Errorf("grammar files have problems:\n  %s", strings.Join(problems, "\n  "))
	}
	existing, err := store.LoadGrammar(ctx)
	if err != nil {
		return err
	}
	if n := len(existing[grammar.TabLessons]); n > 0 && !force {
		return fmt.Errorf("grammar tabs already have %d lessons; pass -force to replace them", n)
	}
	if err := store.ReplaceGrammar(ctx, tables); err != nil {
		return err
	}
	fmt.Printf("wrote %d grammar lessons (%d sections, %d rules, %d examples, %d drills)\n",
		len(tables[grammar.TabLessons]), len(tables[grammar.TabSections]), len(tables[grammar.TabRules]),
		len(tables[grammar.TabExamples]), len(tables[grammar.TabDrills]))
	return nil
}

func seedReading(ctx context.Context, store *sheetstore.Store, dir string, force bool) error {
	content, err := reading.ReadDir(dir)
	if err != nil {
		return err
	}
	tables := reading.Flatten(content)
	if _, problems := reading.Assemble(tables); len(problems) > 0 {
		return fmt.Errorf("reading files have problems:\n  %s", strings.Join(problems, "\n  "))
	}
	existing, err := store.LoadReading(ctx)
	if err != nil {
		return err
	}
	if n := len(existing[reading.TabSets]); n > 0 && !force {
		return fmt.Errorf("reading tabs already have %d sets; pass -force to replace them", n)
	}
	if err := store.ReplaceReading(ctx, tables); err != nil {
		return err
	}
	fmt.Printf("wrote %d reading guides, %d sets (%d passages, %d questions)\n",
		len(tables[reading.TabGuides]), len(tables[reading.TabSets]), len(tables[reading.TabPassages]), len(tables[reading.TabQuestions]))
	return nil
}
