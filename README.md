# 🎵 Mucizp — Free Music Streaming

A personal music streaming web app. Search, play, and organize your favorite songs with playlists and favorites.

## Features

- 🔍 **Search** — Find songs via YouTube Music
- 🎧 **Stream** — Play audio directly in the browser
- ❤️ **Favorites** — Save songs you love (synced via Firebase)
- 📋 **Playlists** — Create and manage custom playlists
- 📜 **Lyrics** — View lyrics for the currently playing song
- 🎨 **Dark UI** — Glassmorphism design with smooth animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Lucide Icons |
| Backend | FastAPI, ytmusicapi |
| Database | Firebase Firestore |
| Playback | ReactPlayer (YouTube) |
| Hosting | Vercel (frontend) + Hugging Face Spaces (backend) |

## Local Development

### Frontend
```bash
npm install
npm run dev
```

### Backend
```bash
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

Set `VITE_BACKEND_URL=http://localhost:8000` in a `.env` file for local dev.

## Deployment

- **Frontend**: Deployed on [Vercel](https://vercel.com) — auto-deploys from GitHub
- **Backend**: Deployed on [Hugging Face Spaces](https://huggingface.co/spaces) via Docker

## License

MIT
