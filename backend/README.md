# TOEIC Vocab API (Go)

Backend for a personal Oxford 3000 flashcard site. Uses spaced repetition (SM-2) and stores data in Google Sheets.

## Run locally (no Google needed)

```sh
cd backend
API_TOKEN=dev go run ./cmd/server          # 10 sample words, progress kept in memory
WORDS_CSV=data/oxford3000.csv go run ./cmd/server   # or load a full list
go test ./...
```

## API

Every `/api/*` route needs `Authorization: Bearer $API_TOKEN`.

| Method | Path | What it does |
|---|---|---|
| GET | `/healthz` | Health check (no token needed) |
| GET | `/api/today?extra=5` | Daily goal: words learned today, review rounds done, `newQueue` (next words from the chosen level), `roundQueue` (today's words not yet seen this round). `extra` adds words past the goal |
| POST | `/api/answer` | Body `{"wordId": 4, "result": "pass" \| "fail", "mode": "learn" \| "review"}`. Returns the word with its new progress |
| PUT | `/api/words/{id}/favorite` | Body `{"favorite": true}` |
| GET | `/api/words?deck=learned&level=B1&status=known&q=agree` | List words. Every filter is optional. `deck` is `learned`, `missed`, `favorites` or `today`; deck lists put the words closest to being forgotten first. `status` is `new`, `learning`, `familiar`, `known` or `mastered` |
| GET | `/api/words/{id}` | One word with its progress |
| GET / PUT | `/api/settings` | `newPerDay`, `roundsPerDay`, `level`, `accent` (`us`/`uk`), `tiers` (pass days for familiar/known/mastered). PUT accepts any subset |
| GET | `/api/stats` | Counts per mastery tier, overall and per level, plus favorites, missed, due today |
| POST | `/api/admin/reload` | Re-read the sheet after you edit it by hand |

**Rules.** Mastery counts days with at least one pass (several passes on one day count once): 2 days = familiar, 5 = known, 10 = mastered (adjustable). A word joins the missed list after 5+ answers with 3 fails among the last 5, and leaves after 3 passes in a row. In learn mode a word counts as learned on its first pass. One review round is one answer for each word learned today.

## Google Sheets setup (one time)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Sheets API**.
2. Go to IAM & Admin → Service Accounts → create one → Keys → Add key → JSON. Download the file and keep it out of git.
3. Create an empty Google Sheet. Share it with the service account's email (`...@...iam.gserviceaccount.com`) as **Editor**.
4. Copy the sheet ID from the URL: `docs.google.com/spreadsheets/d/<SHEET_ID>/edit`.
5. Create the tabs and load the words:

   ```sh
   GOOGLE_SHEET_ID=<id> GOOGLE_CREDENTIALS_FILE=~/keys/toeic.json \
     go run ./cmd/seed -csv data/oxford3000.csv
   ```

   The CSV needs a header row with `word` and optional `id,pos,level,meaning_th,example`.
   Progress is linked to words by `id`, so never renumber the ids.
   To start learning over from zero, run the same command with `-reset-progress` (and without `-csv`).

## Environment variables

| Name | Default | Notes |
|---|---|---|
| `PORT` | `8080` | Render sets this itself |
| `STORE` | `memory` | `sheets` in production |
| `GOOGLE_SHEET_ID` | | Required when `STORE=sheets` |
| `GOOGLE_CREDENTIALS_JSON` / `GOOGLE_CREDENTIALS_FILE` | | Service-account key: paste the JSON contents, or give a path to the file |
| `API_TOKEN` | | Leave unset only for local development |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated frontend URLs, e.g. your Cloudflare Pages domain |
| `APP_TIMEZONE` | `Asia/Bangkok` | Decides when "today" starts |
| `WORDS_CSV` | | Memory store only |

## Deploy to Render

Push the repo to GitHub, then in Render go to New → Blueprint and pick the repo (it uses `render.yaml` at the repo root).
Fill in `GOOGLE_SHEET_ID`, `GOOGLE_CREDENTIALS_JSON` and `ALLOWED_ORIGINS`. Render generates `API_TOKEN` for you.

On the free plan the service sleeps after 15 minutes without traffic, so the first request after that takes about 30–60 s.
The server reads the sheet once at startup and keeps it in memory. Each review writes one row back to the sheet.
