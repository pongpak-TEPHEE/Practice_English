# TOEIC Vocab (React)

Mobile-first flashcard site for the Go API in `../backend`.

## Run locally

```sh
# terminal 1: the API (memory store, full word list)
cd backend && WORDS_CSV=data/oxford3000.csv API_TOKEN=dev go run ./cmd/server

# terminal 2: the site, proxying /api to localhost:8080
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 and sign in with the API token (`dev` above).
To use the real Google Sheet instead, start the API with `STORE=sheets` and the variables from `backend/README.md`.

## Using the cards

- Tap the card to flip between the English word and the Thai meaning.
- Drag right (or press →) when you remembered it, drag left (or press ←) when you didn't. The buttons do the same.
- Space flips, E shows the example sentence, S plays the pronunciation.

## Build for Cloudflare Pages

Set `VITE_API_URL` to the Render API URL, then `npm run build` and deploy `dist/`.
The API's `ALLOWED_ORIGINS` must include the Pages URL.
