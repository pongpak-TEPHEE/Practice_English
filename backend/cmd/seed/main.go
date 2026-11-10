// Command seed prepares the Google Sheet: it creates the words/progress tabs and
// loads a word list from CSV into the words tab.
//
//	GOOGLE_SHEET_ID=... GOOGLE_CREDENTIALS_FILE=key.json go run ./cmd/seed \
//	    -csv data/oxford3000.csv,data/toeic_service_list.csv
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"

	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/config"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/store/sheetstore"
	"github.com/pongpak-TEPHEE/Practice_English/backend/internal/vocab"
)

func main() {
	csvPath := flag.String("csv", "", "comma-separated word list CSVs (header: id,word,pos,level,meaning_th,example)")
	force := flag.Bool("force", false, "replace the words tab even if it already has words")
	resetProgress := flag.Bool("reset-progress", false, "delete all learning progress (start over)")
	flag.Parse()
	if err := run(*csvPath, *force, *resetProgress); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func run(csvPath string, force, resetProgress bool) error {
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
